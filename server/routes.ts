import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertProductSchema, insertOrderSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { printfulService } from "./printful";

// Stripe will be initialized when keys are provided
let stripe: any = null;

// Check if Stripe keys are available and initialize
if (process.env.STRIPE_SECRET_KEY) {
  const Stripe = require("stripe");
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });
}

// Check if Printful is configured
const isPrintfulConfigured = !!process.env.PRINTFUL_API_TOKEN;

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  // Create payment intent for Stripe checkout
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ 
          message: "Payment processing is not configured. Please contact support." 
        });
      }

      const { productId } = req.body;
      const userId = req.user.claims.sub; // Get from authenticated session
      
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

      // Use the stored price (authoritative source)
      const amount = parseFloat(product.price);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          productId,
          userId // Store userId in metadata for verification
        }
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
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

      const { paymentIntentId } = req.body;
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
        status: "completed"
      });

      res.json({ order, product });
    } catch (error: any) {
      res.status(500).json({ message: "Error verifying payment: " + error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
