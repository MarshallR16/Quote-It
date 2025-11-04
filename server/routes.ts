import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupFirebaseAuth, isAuthenticated } from "./firebaseAuth";
import { insertProductSchema, insertOrderSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { printfulService } from "./printful";
import Stripe from "stripe";

// Stripe will be initialized when keys are provided
let stripe: Stripe | null = null;

// Check if Stripe keys are available and initialize
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover",
  });
}

// Check if Printful is configured
const isPrintfulConfigured = !!process.env.PRINTFUL_API_TOKEN;

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Firebase authentication
  await setupFirebaseAuth(app);

  // Helper function to check and reset daily post count
  const checkDailyPostLimit = async (userId: string): Promise<{ canPost: boolean; remaining: number }> => {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastPostDate = user.lastPostDate ? new Date(user.lastPostDate) : null;
    const isNewDay = !lastPostDate || lastPostDate.getTime() < today.getTime();

    let currentCount = isNewDay ? 0 : (user.dailyPostCount || 0);
    const remaining = Math.max(0, 3 - currentCount);
    const canPost = currentCount < 3;

    return { canPost, remaining };
  };

  // Check daily post limit
  app.get('/api/users/daily-post-limit', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { canPost, remaining } = await checkDailyPostLimit(userId);
      res.json({ canPost, remaining, limit: 3 });
    } catch (error: any) {
      console.error("Error checking daily post limit:", error);
      res.status(500).json({ message: "Failed to check post limit" });
    }
  });

  // Get user by ID
  app.get('/api/users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching user: " + error.message });
    }
  });

  // Quote routes
  app.get("/api/quotes", async (_req, res) => {
    try {
      const allQuotes = await storage.getAllQuotes();
      res.json(allQuotes);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching quotes: " + error.message });
    }
  });

  app.get("/api/quotes/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const userQuotes = await storage.getQuotesByUser(userId);
      res.json(userQuotes);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching user quotes: " + error.message });
    }
  });

  app.post("/api/quotes", isAuthenticated, async (req: any, res) => {
    try {
      const { text } = req.body;
      const userId = req.firebaseUser.uid;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ message: "Quote text is required" });
      }

      if (text.length > 280) {
        return res.status(400).json({ message: "Quote must be 280 characters or less" });
      }

      // Atomically check limit, increment counter, and create quote in a single transaction
      const result = await storage.createQuoteWithLimitCheck(userId, {
        text: text.trim(),
        authorId: userId,
      });

      if (!result.success) {
        if (result.error === "Daily limit reached") {
          return res.status(429).json({ 
            message: "Daily limit reached. You can post again tomorrow!",
            remaining: 0,
            limit: 3
          });
        }
        return res.status(400).json({ message: result.error || "Failed to create quote" });
      }

      res.json(result.quote);
    } catch (error: any) {
      res.status(500).json({ message: "Error creating quote: " + error.message });
    }
  });

  app.delete("/api/quotes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.firebaseUser.uid;

      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      if (quote.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this quote" });
      }

      await storage.deleteQuote(id);
      res.json({ message: "Quote deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Error deleting quote: " + error.message });
    }
  });

  // Vote routes
  app.post("/api/votes", isAuthenticated, async (req: any, res) => {
    try {
      const { quoteId, value } = req.body;
      const userId = req.firebaseUser.uid;

      if (!quoteId || (value !== 1 && value !== -1)) {
        return res.status(400).json({ message: "Invalid vote data" });
      }

      // Check if user already voted
      const existingVote = await storage.getVote(quoteId, userId);
      const quote = await storage.getQuote(quoteId);
      
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      let delta = 0;

      if (existingVote) {
        // Update existing vote if different
        if (existingVote.value !== value) {
          delta = value - existingVote.value; // e.g., 1 - (-1) = 2, or -1 - 1 = -2
          const updatedVote = await storage.updateVote(existingVote.id, value);
          res.json(updatedVote);
        } else {
          // Same vote, remove it (toggle off)
          delta = -value; // Remove the vote value
          await storage.deleteVote(existingVote.id);
          res.json({ message: "Vote removed" });
        }
      } else {
        // Create new vote
        delta = value;
        const vote = await storage.createVote({
          quoteId,
          userId,
          value,
        });
        res.json(vote);
      }

      // Update quote voteCount
      if (delta !== 0) {
        await storage.updateQuote(quoteId, {
          voteCount: quote.voteCount + delta,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: "Error voting: " + error.message });
    }
  });

  // Get user's vote for a specific quote
  app.get("/api/votes/quote/:quoteId", isAuthenticated, async (req: any, res) => {
    try {
      const { quoteId } = req.params;
      const userId = req.firebaseUser.uid;

      const vote = await storage.getVote(quoteId, userId);
      res.json(vote || null);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching vote: " + error.message });
    }
  });

  app.get("/api/votes/user/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      // This would need a method in storage to get all user votes
      // For now, return empty array
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching user votes: " + error.message });
    }
  });
  
  // Get all active products
  app.get("/api/products", async (_req, res) => {
    try {
      const products = await storage.getActiveProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching products: " + error.message });
    }
  });

  // Get current weekly winner product (for "Quoted" section)
  app.get("/api/products/weekly-winner", async (_req, res) => {
    try {
      const winner = await storage.getCurrentWeeklyWinner();
      if (!winner) {
        return res.json(null);
      }

      // Get the product associated with this weekly winner
      const products = await storage.getAllProducts();
      const product = products.find(p => p.weeklyWinnerId === winner.id && p.isActive);
      
      if (!product) {
        return res.json(null);
      }

      // Get the quote details
      const quote = await storage.getQuote(product.quoteId);
      
      res.json({
        product,
        quote,
        winner
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching weekly winner: " + error.message });
    }
  });

  // Create Printful product from a quote (admin/automated)
  app.post("/api/products/create-printful", isAuthenticated, async (req: any, res) => {
    try {
      if (!isPrintfulConfigured) {
        return res.status(503).json({ 
          message: "Printful integration not configured" 
        });
      }

      const { quoteId, weeklyWinnerId } = req.body;
      
      if (!quoteId) {
        return res.status(400).json({ message: "quoteId is required" });
      }

      // Get quote details
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Get author info
      const author = await storage.getUser(quote.authorId);
      const authorName = author?.email?.split('@')[0] || 'unknown';

      // Create product in Printful
      console.log('Creating Printful product for quote:', quote.text);
      const printfulProduct = await printfulService.createProduct(
        quote.text,
        authorName,
        `quote-${quoteId}`
      );

      // Create product in our database
      const productData = {
        quoteId,
        weeklyWinnerId: weeklyWinnerId || null,
        name: `"${quote.text.substring(0, 50)}${quote.text.length > 50 ? '...' : ''}"`,
        description: `Quote by ${authorName}`,
        price: '29.99',
        imageUrl: null, // Will be updated with mockup
        printfulSyncProductId: printfulProduct.id,
        printfulSyncVariants: printfulProduct,
        isActive: true,
      };

      const product = await storage.createProduct(productData);
      
      res.json({ 
        product,
        printfulProduct,
        message: 'Product created in Printful successfully'
      });
    } catch (error: any) {
      console.error('Error creating Printful product:', error);
      res.status(500).json({ message: "Error creating product: " + error.message });
    }
  });

  // Get hall of fame entries
  app.get("/api/hall-of-fame", async (_req, res) => {
    try {
      const hallOfFameEntries = await storage.getHallOfFame();
      
      // Get quote details for each entry
      const entriesWithQuotes = await Promise.all(
        hallOfFameEntries.map(async (entry) => {
          const quote = await storage.getQuote(entry.quoteId);
          return {
            ...entry,
            quote
          };
        })
      );
      
      res.json(entriesWithQuotes);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching hall of fame: " + error.message });
    }
  });

  // Select weekly winner and create Printful product automatically
  app.post("/api/admin/select-weekly-winner", isAuthenticated, async (req: any, res) => {
    try {
      // Get all quotes
      const quotes = await storage.getAllQuotes();
      
      if (quotes.length === 0) {
        return res.status(400).json({ message: "No quotes available to select winner" });
      }

      // Find quote with highest vote count
      const topQuote = quotes.reduce((max, quote) => 
        quote.voteCount > max.voteCount ? quote : max
      , quotes[0]);

      // Calculate week start/end dates (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust when day is Sunday
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Create weekly winner
      const winner = await storage.createWeeklyWinner({
        quoteId: topQuote.id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        finalVoteCount: topQuote.voteCount,
      });

      // Automatically create Printful product if configured
      let product = null;
      let printfulProduct = null;
      
      if (isPrintfulConfigured) {
        try {
          // Get author info
          const author = await storage.getUser(topQuote.authorId);
          const authorName = author?.email?.split('@')[0] || 'unknown';

          // Create product in Printful
          console.log('Auto-creating Printful product for weekly winner:', topQuote.text);
          printfulProduct = await printfulService.createProduct(
            topQuote.text,
            authorName,
            `quote-${topQuote.id}`
          );

          // Create product in database
          const productData = {
            quoteId: topQuote.id,
            weeklyWinnerId: winner.id,
            name: `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}"`,
            description: `Quote by ${authorName}`,
            price: '29.99',
            imageUrl: null,
            printfulSyncProductId: printfulProduct.id,
            printfulSyncVariants: printfulProduct,
            isActive: true,
          };

          product = await storage.createProduct(productData);
        } catch (error: any) {
          console.error('Error creating Printful product:', error);
          // Continue even if Printful creation fails
        }
      }

      res.json({ 
        winner, 
        quote: topQuote,
        product,
        printfulProduct,
        message: product ? 'Weekly winner selected and Printful product created' : 'Weekly winner selected'
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error selecting weekly winner: " + error.message });
    }
  });

  // Create payment intent for Stripe checkout
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ 
          message: "Payment processing is not configured. Please contact support." 
        });
      }

      const { productId } = req.body;
      const userId = req.firebaseUser.uid; // Get from authenticated session
      
      if (!productId) {
        return res.status(400).json({ message: "productId is required" });
      }

      // Fetch product from database to get authoritative price
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (!product.isActive) {
        return res.status(400).json({ message: "Product is not available for purchase" });
      }

      // Get user to check referral count for discount
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate referral discount (10% per referral, max 100%)
      const referralCount = user.referralCount || 0;
      const discountPercent = Math.min(referralCount * 10, 100);
      
      // Use the stored price (authoritative source)
      const originalAmount = parseFloat(product.price);
      const discountAmount = originalAmount * (discountPercent / 100);
      const finalAmount = originalAmount - discountAmount;

      console.log('[CHECKOUT] Payment calculation:', {
        userId,
        referralCount,
        discountPercent: `${discountPercent}%`,
        originalAmount: `$${originalAmount.toFixed(2)}`,
        discountAmount: `$${discountAmount.toFixed(2)}`,
        finalAmount: `$${finalAmount.toFixed(2)}`
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(finalAmount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          productId,
          userId, // Store userId in metadata for verification
          originalAmount: originalAmount.toFixed(2),
          discountPercent: discountPercent.toString(),
          discountAmount: discountAmount.toFixed(2),
          referralCount: referralCount.toString()
        }
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        discountInfo: {
          originalAmount,
          discountPercent,
          discountAmount,
          finalAmount,
          referralCount
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Create an order (called after payment intent is created)
  app.post("/api/orders", async (req, res) => {
    try {
      const result = insertOrderSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: fromZodError(result.error).toString() 
        });
      }

      const order = await storage.createOrder(result.data);
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ message: "Error creating order: " + error.message });
    }
  });

  // Get user's orders
  app.get("/api/orders/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const orders = await storage.getOrdersByUser(userId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching orders: " + error.message });
    }
  });

  // Update order status (webhook from Stripe would call this)
  app.post("/api/orders/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, stripePaymentIntentId } = req.body;
      
      const order = await storage.updateOrderStatus(id, status, stripePaymentIntentId);
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ message: "Error updating order: " + error.message });
    }
  });

  // Verify payment and create order (called from success page)
  app.post("/api/verify-payment", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ 
          message: "Payment processing is not configured. Please contact support." 
        });
      }

      const { paymentIntentId, shippingInfo } = req.body;
      const userId = req.user?.claims?.sub; // Get from authenticated session
      
      if (!paymentIntentId) {
        return res.status(400).json({ message: "paymentIntentId is required" });
      }

      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify payment with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({ 
          message: "Payment has not been completed",
          status: paymentIntent.status 
        });
      }

      // Verify userId matches the one in metadata
      const metadataUserId = paymentIntent.metadata.userId;
      if (metadataUserId !== userId) {
        return res.status(403).json({ 
          message: "User ID does not match payment intent" 
        });
      }

      // Get product ID from metadata
      const productId = paymentIntent.metadata.productId;
      
      if (!productId) {
        return res.status(400).json({ message: "Product ID not found in payment metadata" });
      }

      // Get product to get authoritative price
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Check if order already exists for this payment intent (globally, not just for this user)
      // This prevents the same payment intent from being reused to create multiple orders
      const allOrders = await storage.getOrdersByUser(userId);
      // TODO: Implement a more efficient global search across all users
      // For now, we check the user's orders which is sufficient since we verify userId matches metadata
      const existingOrder = allOrders.find(o => o.stripePaymentIntentId === paymentIntentId);
      
      if (existingOrder) {
        // Order already exists, return it
        return res.json({ order: existingOrder, product });
      }

      // Create order with verified data
      const order = await storage.createOrder({
        userId,
        productId,
        stripePaymentIntentId: paymentIntentId,
        amount: product.price,
        status: "processing",
        shippingAddress: shippingInfo ? JSON.stringify(shippingInfo) : null,
        includeAuthor: shippingInfo?.includeAuthor !== false, // default to true if not specified
      });

      // Automatically submit to Printful if configured and shipping info provided
      if (isPrintfulConfigured && shippingInfo && product.printfulSyncProductId) {
        try {
          // Validate shipping info
          if (!shippingInfo.name || !shippingInfo.address1 || !shippingInfo.city || 
              !shippingInfo.state_code || !shippingInfo.zip || !shippingInfo.email || !shippingInfo.size) {
            throw new Error('Missing required shipping information');
          }

          console.log('Submitting order to Printful...');
          
          const variants = product.printfulSyncVariants as any;
          
          // Printful variant IDs for Bella+Canvas 3001 (black)
          const sizeToVariantId: Record<string, number> = {
            'S': 4011,
            'M': 4012,
            'L': 4013,
            'XL': 4014,
            '2XL': 4017,
          };
          
          const targetVariantId = sizeToVariantId[shippingInfo.size];
          
          if (!targetVariantId) {
            throw new Error(`Invalid size: ${shippingInfo.size}`);
          }

          // Find the sync variant with matching variant_id
          const selectedVariant = variants?.sync_variants?.find((v: any) => v.variant_id === targetVariantId);
          
          if (!selectedVariant) {
            throw new Error(`Variant not found for size ${shippingInfo.size}`);
          }

          // Create order in Printful
          const printfulOrder = await printfulService.createOrder(
            `order-${order.id}`,
            {
              name: shippingInfo.name,
              address1: shippingInfo.address1,
              city: shippingInfo.city,
              state_code: shippingInfo.state_code,
              country_code: shippingInfo.country_code || 'US',
              zip: shippingInfo.zip,
              email: shippingInfo.email,
            },
            [{
              sync_variant_id: selectedVariant.id,
              quantity: 1,
            }]
          );

          // Confirm the order (submit for fulfillment)
          await printfulService.confirmOrder(printfulOrder.id);

          // Update order status
          await storage.updateOrder(order.id, {
            status: 'completed',
            printfulOrderId: printfulOrder.id,
          });

          console.log('Printful order created and confirmed:', printfulOrder.id);
        } catch (error: any) {
          console.error('Error creating Printful order:', error);
          // Update order with error status
          await storage.updateOrder(order.id, {
            status: 'failed',
          });
        }
      }

      res.json({ order, product });
    } catch (error: any) {
      res.status(500).json({ message: "Error verifying payment: " + error.message });
    }
  });

  // Follow routes
  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const friends = await storage.getFriends(userId);
      res.json(friends);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching friends: " + error.message });
    }
  });

  app.get('/api/following', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const following = await storage.getFollowing(userId);
      res.json(following);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching following: " + error.message });
    }
  });

  app.get('/api/followers', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const followers = await storage.getFollowers(userId);
      res.json(followers);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching followers: " + error.message });
    }
  });

  // Get follow status with specific user
  app.get('/api/follow/status/:targetUserId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { targetUserId } = req.params;

      // Check if I'm following them
      const iAmFollowing = await storage.getFollow(userId, targetUserId);
      
      // Check if they're following me
      const theyAreFollowing = await storage.getFollow(targetUserId, userId);

      if (iAmFollowing && theyAreFollowing) {
        return res.json({ status: 'friends', isFollowing: true, isFollowedBy: true });
      } else if (iAmFollowing) {
        return res.json({ status: 'following', isFollowing: true, isFollowedBy: false });
      } else if (theyAreFollowing) {
        return res.json({ status: 'follower', isFollowing: false, isFollowedBy: true });
      }

      res.json({ status: 'none', isFollowing: false, isFollowedBy: false });
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching follow status: " + error.message });
    }
  });

  app.post('/api/follow/:targetUserId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { targetUserId } = req.params;

      if (userId === targetUserId) {
        return res.status(400).json({ message: "Cannot follow yourself" });
      }

      // Check if already following
      const existing = await storage.getFollow(userId, targetUserId);
      if (existing) {
        return res.status(400).json({ message: "Already following this user" });
      }

      const follow = await storage.followUser(userId, targetUserId);
      res.json(follow);
    } catch (error: any) {
      res.status(500).json({ message: "Error following user: " + error.message });
    }
  });

  app.delete('/api/follow/:targetUserId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { targetUserId } = req.params;

      await storage.unfollowUser(userId, targetUserId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: "Error unfollowing user: " + error.message });
    }
  });

  app.get('/api/quotes/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const friendsQuotes = await storage.getFriendsQuotes(userId);
      res.json(friendsQuotes);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching friends quotes: " + error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
