import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupFirebaseAuth, isAuthenticated, requireAdmin } from "./firebaseAuth";
import { insertProductSchema, insertOrderSchema, type Product, type WeeklyWinner } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { printfulService } from "./printful";
import Stripe from "stripe";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { selectWeeklyWinner } from "./scheduler";
import sharp from "sharp";
import { containsBlockedContent } from "./contentFilter";

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

// Design base URL for Printful - defaults to production domain
// Printful must be able to access designs externally, so this should be a publicly accessible URL
const DESIGN_BASE_URL = process.env.DESIGN_BASE_URL || 'https://quote-it.co';

// Test Printful connection on startup and verify variant IDs
async function testPrintfulOnStartup() {
  if (isPrintfulConfigured) {
    console.log('[PRINTFUL] API token configured, testing connection...');
    try {
      const result = await printfulService.testConnection();
      if (result.success) {
        console.log('[PRINTFUL] Connection successful:', result.message);
        if (result.storeInfo) {
          console.log('[PRINTFUL] Store info:', JSON.stringify(result.storeInfo));
        }
        
        // Verify correct black variant IDs from catalog
        try {
          const catalogInfo = await printfulService.getCatalogVariants(71);
          console.log('[PRINTFUL] Bella+Canvas 3001 BLACK variant IDs from catalog:');
          catalogInfo.blackVariants.forEach((v: any) => {
            console.log(`  - ${v.size}: ${v.variant_id} (${v.color})`);
          });
          console.log('[PRINTFUL] Code is configured to use: [4016, 4017, 4018, 4019, 4020]');
        } catch (catalogError: any) {
          console.error('[PRINTFUL] Could not fetch catalog variants:', catalogError.message);
        }
      } else {
        console.error('[PRINTFUL] Connection failed:', result.message);
        if (result.error) {
          console.error('[PRINTFUL] Error details:', result.error);
        }
      }
    } catch (error: any) {
      console.error('[PRINTFUL] Startup test error:', error.message);
    }
  } else {
    console.log('[PRINTFUL] API token not configured - Printful integration disabled');
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Firebase authentication
  await setupFirebaseAuth(app);
  
  // Test Printful connection on startup
  testPrintfulOnStartup();
  
  // Endpoint to serve PNG designs for Printful
  // This endpoint serves designs that Printful fetches when creating products.
  // The design is just styled text from publicly-visible quotes, so no sensitive data is exposed.
  // Quote IDs are UUIDs which cannot be enumerated.
  // IMPORTANT: Returns PNG (not SVG) because Printful requires raster images for DTG apparel
  app.get('/api/designs/:quoteId/:textColor', async (req, res) => {
    try {
      const { quoteId, textColor } = req.params;
      const includeAuthor = req.query.includeAuthor !== 'false'; // Default to true
      
      // Validate text color
      if (textColor !== 'white' && textColor !== 'gold') {
        return res.status(400).json({ message: 'Invalid text color' });
      }
      
      console.log(`[DESIGN] Request for quoteId=${quoteId}, textColor=${textColor}, includeAuthor=${includeAuthor}`);
      
      // Get the quote - this is the only check needed since:
      // 1. Quote text is already publicly visible on the site
      // 2. Quote IDs are UUIDs (unguessable)
      // 3. The design is just styled text, not sensitive data
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        console.log(`[DESIGN] Quote not found: ${quoteId}`);
        return res.status(404).json({ message: 'Not found' });
      }
      
      // Get the author (only needed if including attribution)
      let authorName = '';
      if (includeAuthor) {
        const author = await storage.getUser(quote.authorId);
        authorName = author 
          ? `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Anonymous'
          : 'Anonymous';
      }
      
      // Generate the SVG design with sanitized input
      const svg = await printfulService.generateDesignSVGPublic(quote.text, authorName, textColor as 'white' | 'gold', includeAuthor);
      
      // Convert SVG to PNG using sharp - Printful requires raster images (PNG/JPG), not SVG
      // The SVG is 4500x5400 pixels which is high resolution for print
      console.log(`[DESIGN] Converting SVG to PNG for quoteId=${quoteId}`);
      const pngBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();
      
      console.log(`[DESIGN] PNG generated successfully, size: ${pngBuffer.length} bytes`);
      
      // Return as PNG
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(pngBuffer);
    } catch (error: any) {
      console.error('Error generating design:', error);
      // Return generic error to prevent information disclosure
      res.status(500).json({ message: 'Internal error' });
    }
  });

  // Debug endpoint to check if design URL is accessible and generate mockup
  app.get('/api/admin/debug/design/:quoteId', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.firebaseUser.uid);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const { quoteId } = req.params;
      const requestedColor = req.query.textColor as string | undefined;

      // Get the quote
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: 'Quote not found' });
      }

      // Get author info
      const author = await storage.getUser(quote.authorId);
      const authorName = author 
        ? `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Anonymous'
        : 'Anonymous';

      // Build the design URLs using configurable base URL
      const designUrlWhite = `${DESIGN_BASE_URL}/api/designs/${quoteId}/white`;
      const designUrlGold = `${DESIGN_BASE_URL}/api/designs/${quoteId}/gold`;

      // Helper function to test URL accessibility
      const testDesignUrl = async (url: string): Promise<{ accessible: boolean; error: string | null }> => {
        try {
          const axios = (await import('axios')).default;
          const response = await axios.get(url, { timeout: 10000 });
          const accessible = response.status === 200 && response.headers['content-type']?.includes('svg');
          return { accessible, error: null };
        } catch (error: any) {
          return { accessible: false, error: error.message };
        }
      };

      // Test both design URLs or just the requested one
      let whiteTest = { accessible: false, error: null as string | null };
      let goldTest = { accessible: false, error: null as string | null };
      
      if (!requestedColor || requestedColor === 'white') {
        whiteTest = await testDesignUrl(designUrlWhite);
      }
      if (!requestedColor || requestedColor === 'gold') {
        goldTest = await testDesignUrl(designUrlGold);
      }

      // Check if there's an existing product for this quote
      const allProducts = await storage.getAllProducts();
      const productsForQuote = allProducts.filter((p: Product) => p.quoteId === quoteId);
      
      // Check weekly winner status
      const winners = await storage.getAllWeeklyWinners();
      const isWeeklyWinner = winners.some((w: WeeklyWinner) => w.quoteId === quoteId);

      res.json({
        quoteId,
        quoteText: quote.text.substring(0, 100) + (quote.text.length > 100 ? '...' : ''),
        authorName,
        designUrls: {
          white: designUrlWhite,
          gold: designUrlGold,
        },
        designAccessibility: {
          white: whiteTest,
          gold: goldTest,
        },
        printfulConfigured: isPrintfulConfigured,
        existingProducts: productsForQuote.map((p: Product) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          printfulSyncProductId: p.printfulSyncProductId,
          isActive: p.isActive,
        })),
        isWeeklyWinner,
      });
    } catch (error: any) {
      console.error('Debug design error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin endpoint to generate mockup for a product
  app.post('/api/admin/products/:productId/generate-mockup', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.firebaseUser.uid);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Check if Printful is configured
      if (!isPrintfulConfigured) {
        return res.status(400).json({ 
          message: 'Printful is not configured. Cannot generate mockups without PRINTFUL_API_TOKEN.' 
        });
      }

      const { productId } = req.params;
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      // Get the quote for this product
      const quote = await storage.getQuote(product.quoteId);
      if (!quote) {
        return res.status(404).json({ message: 'Quote not found' });
      }

      // Determine text color from product name
      const textColor = product.name.toLowerCase().includes('gold') ? 'gold' : 'white';
      
      // Build design URL using configurable base URL (Printful must be able to access externally)
      const designUrl = `${DESIGN_BASE_URL}/api/designs/${product.quoteId}/${textColor}`;

      // Generate mockup using Printful
      console.log(`[MOCKUP] Generating mockup for product ${productId}, design URL: ${designUrl}`);
      
      // Use variant ID 4018 (L / Black) for mockup - a common size for display
      const mockupUrl = await printfulService.createMockup(4018, designUrl);
      
      // Update product with mockup URL
      await storage.updateProduct(productId, { imageUrl: mockupUrl });
      
      console.log(`[MOCKUP] Mockup generated and stored: ${mockupUrl}`);
      
      res.json({
        success: true,
        productId,
        mockupUrl,
        designUrl,
      });
    } catch (error: any) {
      console.error('Generate mockup error:', error);
      res.status(500).json({ message: error.message });
    }
  });

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

  // Search users
  app.get('/api/users/search', async (req, res) => {
    try {
      const query = req.query.q as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      
      if (!query || query.trim().length < 2) {
        return res.json({ users: [] });
      }
      
      const users = await storage.searchUsers(query, limit);
      res.json({ users });
    } catch (error: any) {
      console.error("Error searching users:", error);
      res.status(500).json({ message: "Failed to search users" });
    }
  });

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

  // Get user by username
  app.get('/api/users/by-username/:username', async (req, res) => {
    try {
      const { username } = req.params;
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching user: " + error.message });
    }
  });

  // Update profile image
  app.put('/api/users/profile-image', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { profileImageUrl } = req.body;

      if (!profileImageUrl || typeof profileImageUrl !== 'string') {
        return res.status(400).json({ message: "Profile image URL is required" });
      }

      await storage.updateUserProfileImage(userId, profileImageUrl);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ message: "Error updating profile image: " + error.message });
    }
  });

  // Accept terms of service
  app.post('/api/users/accept-terms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { accepted, timestamp } = req.body;

      if (accepted !== true) {
        return res.status(400).json({ message: "Terms acceptance confirmation is required" });
      }

      if (!timestamp || typeof timestamp !== 'number') {
        return res.status(400).json({ message: "Valid timestamp is required" });
      }

      const requestAge = Date.now() - timestamp;
      if (requestAge > 60000 || requestAge < 0) {
        return res.status(400).json({ message: "Request expired or invalid timestamp" });
      }
      
      await storage.updateUser(userId, { 
        termsAccepted: true,
        termsAcceptedAt: new Date()
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error accepting terms:", error);
      res.status(500).json({ message: "Error accepting terms: " + error.message });
    }
  });

  // Apply referral code
  app.post('/api/auth/apply-referral', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { referralCode } = req.body;

      if (!referralCode || typeof referralCode !== 'string') {
        return res.status(400).json({ message: "Referral code is required" });
      }

      const referrer = await storage.getUserByReferralCode(referralCode.toUpperCase());
      
      if (!referrer) {
        return res.status(404).json({ message: "Invalid referral code" });
      }

      if (referrer.id === userId) {
        return res.status(400).json({ message: "You cannot use your own referral code" });
      }

      const currentUser = await storage.getUser(userId);
      if (currentUser?.referredBy) {
        return res.status(400).json({ message: "You have already used a referral code" });
      }

      await storage.updateUser(userId, { referredBy: referrer.id });
      await storage.updateUser(referrer.id, { 
        referralCount: (referrer.referralCount || 0) + 1 
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error applying referral code:", error);
      res.status(500).json({ message: "Error applying referral code: " + error.message });
    }
  });

  // Quote routes - returns eligible quotes (last 7 days, not already won)
  app.get("/api/quotes", async (_req, res) => {
    try {
      // Return quotes from last 7 days that haven't won yet
      // Quotes remain on ranking for 7 days and are removed if they win early
      const eligibleQuotes = await storage.getEligibleQuotes();
      res.json(eligibleQuotes);
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

      // Check for blocked content (slurs/derogatory terms)
      const contentCheck = containsBlockedContent(text);
      if (contentCheck.blocked) {
        return res.status(400).json({ message: contentCheck.reason });
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
      const user = await storage.getUser(userId);

      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Allow admins or quote owners to delete
      if (quote.authorId !== userId && !user?.isAdmin) {
        return res.status(403).json({ message: "Not authorized to delete this quote" });
      }

      // Prevent deleting weekly winners to protect store and history
      const isWeeklyWinner = await storage.isQuoteWeeklyWinner(id);
      if (isWeeklyWinner) {
        return res.status(409).json({ 
          message: "Cannot delete this quote because it was selected as a weekly winner" 
        });
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
        `quote-${quoteId}`,
        'white',
        quote.id
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

  // Get hall of fame - top users by wins and total votes
  app.get("/api/hall-of-fame", async (_req, res) => {
    try {
      const userStats = await storage.getHallOfFameUsers();
      res.json(userStats);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching hall of fame: " + error.message });
    }
  });

  // Get shirt archive - all past winning shirts
  app.get("/api/shirt-archive", async (_req, res) => {
    try {
      const winners = await storage.getAllWeeklyWinnersWithDetails();
      res.json(winners);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching shirt archive: " + error.message });
    }
  });

  // Get most recent weekly winner with quote and product details
  app.get("/api/weekly-winner/current", async (_req, res) => {
    try {
      console.log('[API /weekly-winner/current] API version: v2-active-products-fix');
      const data = await storage.getMostRecentWeeklyWinnerWithDetails();
      console.log('[API /weekly-winner/current] Raw data from storage:', JSON.stringify(data).substring(0, 200));
      
      if (!data) {
        console.log('[API /weekly-winner/current] No data found, returning null');
        return res.json({ _apiVersion: 'v2', _error: 'no_data' });
      }
      
      console.log('[API /weekly-winner/current] productId:', data.productId);
      
      // Only return winner data if product exists (product creation might be pending)
      if (!data.productId) {
        console.log('[API /weekly-winner/current] No productId, returning null');
        return res.json({ _apiVersion: 'v2', _error: 'no_product_id', winnerId: data.winnerId });
      }
      
      // Transform flat data into nested structure for StorePage
      const winner = {
        _apiVersion: 'v2',
        product: {
          id: data.productId,
          quoteId: data.quoteId,
          name: data.productName,
          description: data.productDescription,
          price: data.productPrice,
          imageUrl: data.productImageUrl,
          isActive: data.productIsActive,
        },
        quote: {
          id: data.quoteId,
          text: data.quoteText,
          authorId: data.authorId,
        },
        winner: {
          id: data.winnerId,
          weekStartDate: data.weekStartDate,
          weekEndDate: data.weekEndDate,
          finalVoteCount: data.finalVoteCount,
        },
        // Keep flat fields for LeaderboardPage compatibility
        ...data,
      };
      
      res.json(winner);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching current weekly winner: " + error.message });
    }
  });

  // Select weekly winner and create Printful product automatically
  app.post("/api/admin/select-weekly-winner", requireAdmin, async (req: any, res: any) => {
    try {
      const result = await selectWeeklyWinner();
      if (!result) {
        return res.status(500).json({ message: "Failed to select weekly winner" });
      }
      res.json({ 
        success: true,
        winner: result.winner,
        quote: result.quote,
        product: result.product,
        winnerProduct: result.winnerProduct,
        message: 'Weekly winner selected and Printful products created'
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error selecting weekly winner: " + error.message });
    }
  });

  // Admin analytics endpoint
  app.get("/api/admin/analytics", requireAdmin, async (req: any, res: any) => {
    try {
      const analytics = await db.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM orders WHERE status = 'completed' AND is_complimentary = false) as total_orders,
          (SELECT COALESCE(SUM(amount), 0) FROM orders WHERE status = 'completed' AND is_complimentary = false) as total_revenue,
          (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
          (SELECT COUNT(DISTINCT product_id) FROM orders WHERE status = 'completed' AND is_complimentary = false) as products_sold_count,
          (SELECT COUNT(*) FROM products WHERE is_active = true) as active_products
      `);
      
      res.json(analytics.rows[0]);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching analytics: " + error.message });
    }
  });

  // Recent orders endpoint
  app.get("/api/admin/recent-orders", requireAdmin, async (req: any, res: any) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const orders = await db.execute(sql`
        SELECT 
          o.id,
          o.user_id,
          o.product_id,
          o.amount,
          o.status,
          o.include_author,
          o.created_at,
          u.email as customer_email,
          u.first_name || ' ' || u.last_name as customer_name,
          p.name as product_name
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN products p ON o.product_id = p.id
        ORDER BY o.created_at DESC
        LIMIT ${limit}
      `);
      
      res.json(orders.rows);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching orders: " + error.message });
    }
  });

  // Test Printful API connection
  app.get("/api/admin/printful/test", requireAdmin, async (req: any, res: any) => {
    try {
      const result = await printfulService.testConnection();
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        message: "Error testing Printful connection",
        error: error.message 
      });
    }
  });

  // List all products from Printful store
  app.get("/api/admin/printful/products", requireAdmin, async (req: any, res: any) => {
    try {
      if (!isPrintfulConfigured) {
        return res.status(400).json({ message: "Printful is not configured" });
      }
      
      const products = await printfulService.listProducts();
      
      // Get detailed info for first few products to show file status
      const detailedProducts = await Promise.all(
        products.slice(0, 5).map(async (p: any) => {
          try {
            const details = await printfulService.getProductDetails(p.id);
            return {
              ...p,
              hasFiles: details.sync_variants?.some((v: any) => v.files && v.files.length > 0),
              variantCount: details.sync_variants?.length || 0,
              firstVariantFiles: details.sync_variants?.[0]?.files || []
            };
          } catch {
            return { ...p, error: 'Could not fetch details' };
          }
        })
      );
      
      res.json({
        totalProducts: products.length,
        products: products,
        detailedSample: detailedProducts
      });
    } catch (error: any) {
      res.status(500).json({ 
        message: "Error listing Printful products",
        error: error.message 
      });
    }
  });

  // Re-create Printful products for a weekly winner that's missing them
  // Creates 3 products: gold (winner), white+author (for sale), white no-author (for sale)
  app.post("/api/admin/printful/recreate-products/:winnerId", requireAdmin, async (req: any, res: any) => {
    try {
      const { winnerId } = req.params;
      const { goldOnly } = req.query; // Optional: only create gold product
      
      // Get the weekly winner
      const winner = await storage.getWeeklyWinner(winnerId);
      if (!winner) {
        return res.status(404).json({ message: "Weekly winner not found" });
      }

      // Get the quote
      const quote = await storage.getQuote(winner.quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found for this winner" });
      }

      // Get the author
      const author = await storage.getUser(quote.authorId);
      if (!author) {
        return res.status(404).json({ message: "Author not found for this quote" });
      }

      const authorName = `${author.firstName || ''} ${author.lastName || ''}`.trim() || 'Anonymous';
      const truncatedQuote = `"${quote.text.substring(0, 50)}${quote.text.length > 50 ? '...' : ''}"`;

      // Check if Printful is configured
      if (!isPrintfulConfigured) {
        return res.status(400).json({ 
          message: "Printful is not configured. Please set PRINTFUL_API_TOKEN." 
        });
      }

      // First test connection
      const connectionTest = await printfulService.testConnection();
      if (!connectionTest.success) {
        return res.status(400).json({
          message: "Printful connection failed: " + connectionTest.message,
          error: connectionTest.error
        });
      }

      const results = {
        whiteWithAuthor: null as any,
        whiteNoAuthor: null as any,
        goldProduct: null as any,
        errors: [] as string[]
      };

      // Skip white products if goldOnly is set
      if (!goldOnly) {
        // Create white text product WITH author (for sale)
        try {
          console.log('[ADMIN] Creating white text product WITH author...');
          const printfulProduct = await printfulService.createProduct(
            quote.text,
            authorName,
            `quote-${quote.id}-white-author`,
            'white',
            quote.id,
            true // includeAuthor = true
          );

          // Find existing "With Attribution" product
          const allProducts = await storage.getAllProducts();
          const existingProduct = allProducts.find(p => 
            p.quoteId === quote.id && p.name.includes("With Attribution")
          );

          if (existingProduct) {
            await storage.updateProduct(existingProduct.id, {
              printfulSyncProductId: printfulProduct.id,
              printfulSyncVariants: printfulProduct,
            });
            results.whiteWithAuthor = { id: existingProduct.id, printfulId: printfulProduct.id, updated: true };
          } else {
            const newProduct = await storage.createProduct({
              quoteId: quote.id,
              weeklyWinnerId: winner.id,
              name: `${truncatedQuote} - With Attribution`,
              description: `Quote by ${authorName}`,
              price: '29.99',
              imageUrl: null,
              isActive: true,
              printfulSyncProductId: printfulProduct.id,
              printfulSyncVariants: printfulProduct,
            });
            results.whiteWithAuthor = { id: newProduct.id, printfulId: printfulProduct.id, created: true };
          }
          console.log('[ADMIN] White+author product created/updated successfully');
        } catch (error: any) {
          console.error('[ADMIN] Error creating white+author product:', error.message);
          results.errors.push(`White+author product: ${error.message}`);
        }

        // Create white text product WITHOUT author (for sale)
        try {
          console.log('[ADMIN] Creating white text product WITHOUT author...');
          const printfulProductNoAuthor = await printfulService.createProduct(
            quote.text,
            '',
            `quote-${quote.id}-white-noauthor`,
            'white',
            quote.id,
            false // includeAuthor = false
          );

          // Find existing "Quote Only" product
          const allProducts = await storage.getAllProducts();
          const existingProduct = allProducts.find(p => 
            p.quoteId === quote.id && p.name.includes("Quote Only")
          );

          if (existingProduct) {
            await storage.updateProduct(existingProduct.id, {
              printfulSyncProductId: printfulProductNoAuthor.id,
              printfulSyncVariants: printfulProductNoAuthor,
            });
            results.whiteNoAuthor = { id: existingProduct.id, printfulId: printfulProductNoAuthor.id, updated: true };
          } else {
            const newProduct = await storage.createProduct({
              quoteId: quote.id,
              weeklyWinnerId: winner.id,
              name: `${truncatedQuote} - Quote Only`,
              description: `Weekly Winner Quote (no attribution)`,
              price: '29.99',
              imageUrl: null,
              isActive: true,
              printfulSyncProductId: printfulProductNoAuthor.id,
              printfulSyncVariants: printfulProductNoAuthor,
            });
            results.whiteNoAuthor = { id: newProduct.id, printfulId: printfulProductNoAuthor.id, created: true };
          }
          console.log('[ADMIN] White no-author product created/updated successfully');
        } catch (error: any) {
          console.error('[ADMIN] Error creating white no-author product:', error.message);
          results.errors.push(`White no-author product: ${error.message}`);
        }
      }

      // Create gold text product (winner exclusive)
      try {
        console.log('[ADMIN] Creating gold text Printful product...');
        const printfulWinnerProduct = await printfulService.createProduct(
          quote.text,
          authorName,
          `quote-${quote.id}-gold`,
          'gold',
          quote.id,
          true // includeAuthor = true
        );

        // Find or update the existing gold product
        const allProducts = await storage.getAllProducts();
        const existingGoldProduct = allProducts.find(p => 
          p.quoteId === quote.id && p.name.includes("Gold Edition")
        );

        if (existingGoldProduct) {
          await storage.updateProduct(existingGoldProduct.id, {
            printfulSyncProductId: printfulWinnerProduct.id,
            printfulSyncVariants: printfulWinnerProduct,
          });
          results.goldProduct = { id: existingGoldProduct.id, printfulId: printfulWinnerProduct.id, updated: true };
          
          // Update winner's complimentary order to use gold product
          await storage.updateWeeklyWinner(winner.id, { winnerProductId: existingGoldProduct.id });
        } else {
          const winnerProduct = await storage.createProduct({
            quoteId: quote.id,
            weeklyWinnerId: winner.id,
            name: `${truncatedQuote} (Winner's Gold Edition)`,
            description: `Quote by ${authorName} - Exclusive Winner's Edition with Gold Text`,
            price: '0.00',
            imageUrl: null,
            isActive: false,
            printfulSyncProductId: printfulWinnerProduct.id,
            printfulSyncVariants: printfulWinnerProduct,
          });
          results.goldProduct = { id: winnerProduct.id, printfulId: printfulWinnerProduct.id, created: true };
          
          // Update winner with gold product reference
          await storage.updateWeeklyWinner(winner.id, { winnerProductId: winnerProduct.id });
        }
        console.log('[ADMIN] Gold text product created/updated successfully');
      } catch (error: any) {
        console.error('[ADMIN] Error creating gold product:', error.message);
        results.errors.push(`Gold product: ${error.message}`);
      }

      const hasAnySuccess = results.whiteWithAuthor || results.whiteNoAuthor || results.goldProduct;
      if (!hasAnySuccess) {
        return res.status(500).json({
          message: "Failed to create any products",
          errors: results.errors
        });
      }

      res.json({
        message: results.errors.length > 0 ? "Partially successful" : "Products created successfully",
        results
      });
    } catch (error: any) {
      console.error('[ADMIN] Error recreating Printful products:', error);
      res.status(500).json({ message: "Error recreating products: " + error.message });
    }
  });

  // List all weekly winners with their product status
  app.get("/api/admin/printful/winners", requireAdmin, async (req: any, res: any) => {
    try {
      const winners = await storage.getAllWeeklyWinners();
      
      // Get product info for each winner
      const winnersWithProducts = await Promise.all(winners.map(async (winner) => {
        const quote = await storage.getQuote(winner.quoteId);
        const allProducts = await storage.getAllProducts();
        const products = allProducts.filter(p => p.quoteId === winner.quoteId);
        
        return {
          id: winner.id,
          weekOf: winner.weekStartDate,
          quoteText: quote?.text?.substring(0, 100) + (quote?.text && quote.text.length > 100 ? '...' : ''),
          products: products.map(p => ({
            id: p.id,
            name: p.name.substring(0, 50),
            isActive: p.isActive,
            hasPrintfulSync: !!p.printfulSyncProductId
          }))
        };
      }));

      res.json(winnersWithProducts);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching winners: " + error.message });
    }
  });

  // Delete ALL products from Printful and clear sync IDs from database
  app.post("/api/admin/printful/delete-all", requireAdmin, async (req: any, res: any) => {
    try {
      console.log('[ADMIN] Deleting ALL Printful products...');

      if (!isPrintfulConfigured) {
        return res.status(400).json({ message: 'Printful is not configured' });
      }

      // Delete all products from Printful
      const deletedCount = await printfulService.deleteAllProducts();

      // Clear all Printful sync IDs from database products
      const allProducts = await storage.getAllProducts();
      let clearedCount = 0;
      for (const product of allProducts) {
        if (product.printfulSyncProductId) {
          await storage.updateProduct(product.id, {
            printfulSyncProductId: null,
            printfulSyncVariants: null
          });
          clearedCount++;
        }
      }

      console.log(`[ADMIN] Deleted ${deletedCount} Printful products, cleared ${clearedCount} DB sync IDs`);
      res.json({ 
        message: `Deleted ${deletedCount} products from Printful and cleared ${clearedCount} sync IDs from database`,
        printfulDeleted: deletedCount,
        dbCleared: clearedCount
      });
    } catch (error: any) {
      console.error('[ADMIN] Delete all products error:', error.message);
      res.status(500).json({ message: "Error deleting products: " + error.message });
    }
  });

  // Sync all products with Printful for the most recent weekly winner
  // Creates/updates all three products:
  // 1. Gold Edition (gold text with author) - winner exclusive, NOT for sale
  // 2. White with author (white text with author) - for sale
  // 3. White no-author (white text, no author) - for sale
  app.post("/api/admin/sync-gold-product", requireAdmin, async (req: any, res: any) => {
    try {
      console.log('[ADMIN] Syncing all products with Printful...');

      // Check if Printful is configured
      if (!isPrintfulConfigured) {
        return res.status(400).json({ 
          message: 'Printful is not configured. Cannot sync without PRINTFUL_API_TOKEN.' 
        });
      }

      // Test Printful connection
      const connectionTest = await printfulService.testConnection();
      if (!connectionTest.success) {
        return res.status(503).json({ 
          message: 'Printful connection failed: ' + connectionTest.message 
        });
      }

      // Get most recent weekly winner
      const winner = await storage.getMostRecentWeeklyWinnerWithDetails();
      if (!winner) {
        return res.status(404).json({ message: 'No weekly winners found' });
      }

      console.log(`[ADMIN] Found winner: ${winner.winnerId}, quote: ${winner.quoteId}`);

      // Get author info
      const author = await storage.getUser(winner.authorId);
      const authorName = author 
        ? `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || author.email?.split('@')[0] || 'Anonymous'
        : winner.authorUsername || 'Anonymous';

      // External IDs for all three products
      const goldExternalId = `quote-${winner.quoteId}-gold`;
      const whiteWithAuthorExternalId = `quote-${winner.quoteId}-white`;
      const whiteNoAuthorExternalId = `quote-${winner.quoteId}-white-noauthor`;
      
      // Build design URLs
      const goldDesignUrl = `${DESIGN_BASE_URL}/api/designs/${winner.quoteId}/gold`;
      const whiteWithAuthorDesignUrl = `${DESIGN_BASE_URL}/api/designs/${winner.quoteId}/white`;
      const whiteNoAuthorDesignUrl = `${DESIGN_BASE_URL}/api/designs/${winner.quoteId}/white?includeAuthor=false`;

      const results: any = {
        goldProduct: null,
        whiteWithAuthorProduct: null,
        whiteNoAuthorProduct: null
      };

      // Get all existing products for this quote
      const allProducts = await storage.getAllProducts();
      const existingGoldDbProduct = allProducts.find((p: Product) => 
        p.quoteId === winner.quoteId && p.name.includes('Gold Edition')
      );
      const existingWhiteWithAuthorDbProduct = allProducts.find((p: Product) => 
        p.quoteId === winner.quoteId && !p.name.includes('Gold') && !p.name.includes('No Author') && p.name.includes('White')
      );
      const existingWhiteNoAuthorDbProduct = allProducts.find((p: Product) => 
        p.quoteId === winner.quoteId && p.name.includes('No Author')
      );

      // === 1. GOLD PRODUCT (winner exclusive, NOT for sale) ===
      // Identical to white product creation - just different text color
      console.log(`[ADMIN] ========== GOLD PRODUCT DEBUG ==========`);
      console.log(`[ADMIN] Gold external_id: ${goldExternalId}`);
      console.log(`[ADMIN] Searching Printful for existing gold product...`);
      let existingGoldPrintful = await printfulService.findProductByExternalId(goldExternalId);
      console.log(`[ADMIN] findProductByExternalId result:`, existingGoldPrintful ? JSON.stringify(existingGoldPrintful).substring(0, 300) : 'NULL');
      let printfulGoldProduct: any = null;

      if (existingGoldPrintful) {
        console.log(`[ADMIN] REUSING existing gold product from Printful: ${existingGoldPrintful.sync_product?.id}`);
        printfulGoldProduct = existingGoldPrintful;
      } else {
        console.log(`[ADMIN] No gold product in Printful - CREATING NEW...`);
        console.log(`[ADMIN] Calling createProduct('${winner.quoteText.substring(0,30)}...', '${authorName}', '${goldExternalId}', 'gold', '${winner.quoteId}', true)`);
        printfulGoldProduct = await printfulService.createProduct(
          winner.quoteText, authorName, goldExternalId, 'gold', winner.quoteId, true
        );
        console.log(`[ADMIN] createProduct returned:`, JSON.stringify(printfulGoldProduct).substring(0, 500));
      }
      console.log(`[ADMIN] ========== END GOLD DEBUG ==========`);

      // Extract sync ID and save to DB
      const goldSyncId = printfulGoldProduct?.sync_product?.id || printfulGoldProduct?.id;
      if (!goldSyncId) {
        throw new Error('Gold product creation failed - no sync ID returned from Printful');
      }
      
      if (existingGoldDbProduct) {
        await storage.updateProduct(existingGoldDbProduct.id, {
          printfulSyncProductId: goldSyncId,
          printfulSyncVariants: printfulGoldProduct,
          isActive: false
        });
        results.goldProduct = { id: existingGoldDbProduct.id, printfulId: goldSyncId, updated: true };
      } else {
        const productName = `"${winner.quoteText.substring(0, 50)}${winner.quoteText.length > 50 ? '...' : ''}" - Gold Edition`;
        const newProduct = await storage.createProduct({
          quoteId: winner.quoteId,
          name: productName,
          description: `Winner's exclusive gold edition t-shirt featuring: "${winner.quoteText}" by ${authorName}`,
          price: '29.99',
          imageUrl: null,
          isActive: false,
          printfulSyncProductId: goldSyncId,
          printfulSyncVariants: printfulGoldProduct,
        });
        results.goldProduct = { id: newProduct.id, printfulId: goldSyncId, created: true };
      }
      console.log(`[ADMIN] Gold product synced with Printful ID: ${goldSyncId}`);

      // === 2. WHITE WITH AUTHOR (for sale) ===
      console.log(`[ADMIN] Processing White with Author product...`);
      let existingWhiteWithAuthorPrintful = await printfulService.findProductByExternalId(whiteWithAuthorExternalId);
      let printfulWhiteWithAuthorProduct: any = null;

      if (existingWhiteWithAuthorPrintful) {
        console.log(`[ADMIN] Found existing white with author product in Printful: ${existingWhiteWithAuthorPrintful.sync_product?.id}`);
        printfulWhiteWithAuthorProduct = existingWhiteWithAuthorPrintful;
      } else {
        console.log(`[ADMIN] Creating white with author product in Printful...`);
        printfulWhiteWithAuthorProduct = await printfulService.createProduct(
          winner.quoteText, authorName, whiteWithAuthorExternalId, 'white', winner.quoteId, true
        );
        console.log(`[ADMIN] Created white with author product: ${printfulWhiteWithAuthorProduct?.id}`);
      }

      const whiteSyncId = printfulWhiteWithAuthorProduct?.sync_product?.id || printfulWhiteWithAuthorProduct?.id;
      if (!whiteSyncId) {
        throw new Error('White with author product creation failed - no sync ID returned from Printful');
      }
      
      if (existingWhiteWithAuthorDbProduct) {
        await storage.updateProduct(existingWhiteWithAuthorDbProduct.id, {
          printfulSyncProductId: whiteSyncId,
          printfulSyncVariants: printfulWhiteWithAuthorProduct,
          isActive: true
        });
        results.whiteWithAuthorProduct = { id: existingWhiteWithAuthorDbProduct.id, printfulId: whiteSyncId, updated: true };
      } else {
        const productName = `"${winner.quoteText.substring(0, 50)}${winner.quoteText.length > 50 ? '...' : ''}" - White Edition`;
        const newProduct = await storage.createProduct({
          quoteId: winner.quoteId,
          name: productName,
          description: `Classic white text t-shirt featuring: "${winner.quoteText}" by ${authorName}`,
          price: '29.99',
          imageUrl: null,
          isActive: true,
          printfulSyncProductId: whiteSyncId,
          printfulSyncVariants: printfulWhiteWithAuthorProduct,
        });
        results.whiteWithAuthorProduct = { id: newProduct.id, printfulId: whiteSyncId, created: true };
      }
      console.log(`[ADMIN] White with author product synced with Printful ID: ${whiteSyncId}`);

      // === 3. WHITE NO AUTHOR (for sale) ===
      console.log(`[ADMIN] Processing White No Author product...`);
      let existingWhiteNoAuthorPrintful = await printfulService.findProductByExternalId(whiteNoAuthorExternalId);
      let printfulWhiteNoAuthorProduct: any = null;

      if (existingWhiteNoAuthorPrintful) {
        console.log(`[ADMIN] Found existing white no author product in Printful: ${existingWhiteNoAuthorPrintful.sync_product?.id}`);
        printfulWhiteNoAuthorProduct = existingWhiteNoAuthorPrintful;
      } else {
        console.log(`[ADMIN] Creating white no author product in Printful...`);
        printfulWhiteNoAuthorProduct = await printfulService.createProduct(
          winner.quoteText, authorName, whiteNoAuthorExternalId, 'white', winner.quoteId, false
        );
        console.log(`[ADMIN] Created white no author product: ${printfulWhiteNoAuthorProduct?.id}`);
      }

      const noAuthorSyncId = printfulWhiteNoAuthorProduct?.sync_product?.id || printfulWhiteNoAuthorProduct?.id;
      if (!noAuthorSyncId) {
        throw new Error('White no author product creation failed - no sync ID returned from Printful');
      }
      
      if (existingWhiteNoAuthorDbProduct) {
        await storage.updateProduct(existingWhiteNoAuthorDbProduct.id, {
          printfulSyncProductId: noAuthorSyncId,
          printfulSyncVariants: printfulWhiteNoAuthorProduct,
          isActive: true
        });
        results.whiteNoAuthorProduct = { id: existingWhiteNoAuthorDbProduct.id, printfulId: noAuthorSyncId, updated: true };
      } else {
        const productName = `"${winner.quoteText.substring(0, 50)}${winner.quoteText.length > 50 ? '...' : ''}" - White Edition (No Author)`;
        const newProduct = await storage.createProduct({
          quoteId: winner.quoteId,
          name: productName,
          description: `Minimalist white text t-shirt featuring: "${winner.quoteText}"`,
          price: '29.99',
          imageUrl: null,
          isActive: true,
          printfulSyncProductId: noAuthorSyncId,
          printfulSyncVariants: printfulWhiteNoAuthorProduct,
        });
        results.whiteNoAuthorProduct = { id: newProduct.id, printfulId: noAuthorSyncId, created: true };
      }
      console.log(`[ADMIN] White no author product synced with Printful ID: ${noAuthorSyncId}`);

      // Validate that sync IDs were obtained
      const errors: string[] = [];
      if (!results.goldProduct?.printfulId) {
        errors.push('Gold product: No Printful sync ID obtained');
      }
      if (!results.whiteWithAuthorProduct?.printfulId) {
        errors.push('White with author: No Printful sync ID obtained');
      }
      if (!results.whiteNoAuthorProduct?.printfulId) {
        errors.push('White no author: No Printful sync ID obtained');
      }

      if (errors.length > 0) {
        console.error('[ADMIN] Sync completed with errors:', errors);
        return res.status(207).json({
          message: `Sync completed with ${errors.length} issues`,
          errors,
          results,
          winner: {
            id: winner.winnerId,
            quoteId: winner.quoteId,
            authorName
          },
          designUrls: {
            gold: goldDesignUrl,
            whiteWithAuthor: whiteWithAuthorDesignUrl,
            whiteNoAuthor: whiteNoAuthorDesignUrl
          }
        });
      }

      console.log('[ADMIN] All products synced successfully with IDs:', {
        gold: results.goldProduct?.printfulId,
        whiteWithAuthor: results.whiteWithAuthorProduct?.printfulId,
        whiteNoAuthor: results.whiteNoAuthorProduct?.printfulId
      });

      res.json({
        message: 'All products synced successfully',
        results,
        winner: {
          id: winner.winnerId,
          quoteId: winner.quoteId,
          authorName
        },
        designUrls: {
          gold: goldDesignUrl,
          whiteWithAuthor: whiteWithAuthorDesignUrl,
          whiteNoAuthor: whiteNoAuthorDesignUrl
        }
      });
    } catch (error: any) {
      console.error('[ADMIN] Error syncing products:', error);
      res.status(500).json({ message: 'Error syncing products: ' + error.message });
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

      // Calculate available discounts (referrals - used discounts)
      const referralCount = user.referralCount || 0;
      const usedDiscounts = user.usedReferralDiscounts || 0;
      const availableDiscounts = referralCount - usedDiscounts;
      const discountPercent = availableDiscounts > 0 ? 10 : 0;
      
      // Use the stored price (authoritative source)
      const originalAmount = parseFloat(product.price);
      const discountAmount = originalAmount * (discountPercent / 100);
      const finalAmount = originalAmount - discountAmount;

      console.log('[CHECKOUT] Payment calculation:', {
        userId,
        referralCount,
        usedDiscounts,
        availableDiscounts,
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
          referralCount: referralCount.toString(),
          usedDiscount: discountPercent > 0 ? 'true' : 'false'
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
          referralCount,
          availableDiscounts
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

  // Get complimentary orders for current user
  app.get("/api/orders/my-complimentary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const allOrders = await storage.getOrdersByUser(userId);
      const complimentaryOrders = allOrders.filter((order: any) => order.isComplimentary);
      res.json(complimentaryOrders);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching complimentary orders: " + error.message });
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
      const userId = req.firebaseUser.uid; // Get from authenticated session
      
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

      // If a referral discount was used, increment the used discount counter
      if (paymentIntent.metadata.usedDiscount === 'true') {
        await storage.incrementUsedReferralDiscounts(userId);
        console.log('[ORDER] Incremented used referral discount for user:', userId);
      }

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

  // Get quotes from people I follow (not just mutual friends)
  app.get('/api/quotes/following', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const followingQuotes = await storage.getFollowingQuotes(userId);
      res.json(followingQuotes);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching following quotes: " + error.message });
    }
  });

  app.get('/api/quotes/personalized', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const personalizedQuotes = await storage.getPersonalizedQuotes(userId);
      res.json(personalizedQuotes);
    } catch (error: any) {
      console.error('[PERSONALIZATION] Error:', error);
      res.status(500).json({ message: "Error fetching personalized quotes: " + error.message });
    }
  });

  // Endpoint to make yourself admin (only works if no admins exist)
  app.post("/api/admin/make-me-admin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      
      // Check if any admins exist
      const allUsers = await db.select().from(users);
      const existingAdmin = allUsers.find(u => u.isAdmin);
      
      if (existingAdmin) {
        return res.status(403).json({ 
          message: "An admin already exists. Contact the existing admin to grant you admin privileges.",
          adminEmail: existingAdmin.email
        });
      }
      
      // Make this user admin
      const updatedUser = await storage.updateUser(userId, { isAdmin: true });
      
      res.json({ 
        message: "You are now an admin!",
        user: updatedUser
      });
    } catch (error: any) {
      console.error("Error making user admin:", error);
      res.status(500).json({ message: "Error making user admin: " + error.message });
    }
  });

  // Test endpoint to preview T-shirt design SVG
  app.get('/api/test/design-preview', async (req, res) => {
    try {
      const quoteText = req.query.quote as string || "The only thing we have to fear is fear itself.";
      const author = req.query.author as string || "Franklin D. Roosevelt";
      const textColor = (req.query.color as 'white' | 'gold') || 'white';
      
      // Use private method via reflection to generate SVG
      const svg = await (printfulService as any).generateDesignSVG(quoteText, author, textColor);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    } catch (error: any) {
      console.error("Error generating design preview:", error);
      res.status(500).json({ message: "Error generating design preview: " + error.message });
    }
  });

  // Get pending complimentary order for winner (awaiting shipping address)
  app.get('/api/winner/pending-order', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      
      // Get all orders for the user
      const allOrders = await storage.getOrdersByUser(userId);
      
      // Find a complimentary order that's awaiting an address
      const pendingWinnerOrder = allOrders.find(
        (order: any) => order.isComplimentary && order.status === 'awaiting_address'
      );
      
      if (!pendingWinnerOrder) {
        return res.json(null);
      }
      
      // Get the product and quote info for this order
      const product = await storage.getProduct(pendingWinnerOrder.productId);
      if (!product) {
        return res.json(null);
      }
      
      const quote = await storage.getQuote(product.quoteId);
      if (!quote) {
        return res.json(null);
      }
      
      // Get the weekly winner info
      const weeklyWinner = product.weeklyWinnerId 
        ? await storage.getWeeklyWinner(product.weeklyWinnerId)
        : null;
      
      res.json({
        order: {
          id: pendingWinnerOrder.id,
          productId: pendingWinnerOrder.productId,
          status: pendingWinnerOrder.status,
          isComplimentary: pendingWinnerOrder.isComplimentary,
        },
        quote: {
          id: quote.id,
          text: quote.text,
        },
        product: {
          id: product.id,
          name: product.name,
        },
        winner: weeklyWinner ? {
          id: weeklyWinner.id,
          weekStartDate: weeklyWinner.weekStartDate,
          weekEndDate: weeklyWinner.weekEndDate,
          finalVoteCount: weeklyWinner.finalVoteCount,
        } : null,
      });
    } catch (error: any) {
      console.error("Error checking winner order:", error);
      res.status(500).json({ message: "Error checking winner order: " + error.message });
    }
  });

  // Submit shipping info for a complimentary winner order
  app.post('/api/orders/:id/shipping', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id: orderId } = req.params;
      const shippingInfo = req.body;
      
      // Validate required fields
      const requiredFields = ['name', 'email', 'address1', 'city', 'state_code', 'country_code', 'zip', 'size'];
      for (const field of requiredFields) {
        if (!shippingInfo[field]) {
          return res.status(400).json({ message: `${field} is required` });
        }
      }
      
      // Get the order and verify it belongs to this user
      const allOrders = await storage.getOrdersByUser(userId);
      const order = allOrders.find((o: any) => o.id === orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      
      if (!order.isComplimentary) {
        return res.status(403).json({ message: "This endpoint is only for complimentary orders" });
      }
      
      if (order.status !== 'awaiting_address') {
        return res.status(400).json({ message: "Order is not awaiting address" });
      }
      
      // Update the order with shipping info and change status to processing
      let updatedOrder = await storage.updateOrder(orderId, {
        shippingAddress: shippingInfo,
        status: 'processing',
      });
      
      // If Printful is configured, attempt to create the fulfillment order
      if (isPrintfulConfigured && printfulService) {
        try {
          const product = await storage.getProduct(order.productId);
          if (product?.printfulSyncProductId) {
            console.log('[WINNER ORDER] Creating Printful fulfillment for complimentary order:', orderId);
            
            // Get the sync variant ID for the selected size
            const syncVariantId = await printfulService.getSyncVariantForSize(
              product.printfulSyncProductId,
              shippingInfo.size
            );
            
            if (!syncVariantId) {
              throw new Error(`Could not find variant for size ${shippingInfo.size}`);
            }
            
            console.log('[WINNER ORDER] Found sync variant ID:', syncVariantId, 'for size:', shippingInfo.size);
            
            // Create the Printful order
            const printfulOrder = await printfulService.createOrder(
              `winner-${orderId}`,
              {
                name: shippingInfo.name,
                address1: shippingInfo.address1,
                city: shippingInfo.city,
                state_code: shippingInfo.state_code,
                country_code: shippingInfo.country_code,
                zip: shippingInfo.zip,
                email: shippingInfo.email,
              },
              [{
                sync_variant_id: syncVariantId,
                quantity: 1,
              }]
            );
            
            console.log('[WINNER ORDER] Printful order created:', printfulOrder.id);
            
            // Save the Printful order ID immediately so we have a reference even if confirmation fails
            updatedOrder = await storage.updateOrder(orderId, {
              printfulOrderId: printfulOrder.id,
              status: 'pending_confirmation',
            });
            
            // Confirm the order (submit for fulfillment)
            try {
              const confirmedOrder = await printfulService.confirmOrder(printfulOrder.id);
              console.log('[WINNER ORDER] Printful order confirmed:', confirmedOrder.id, 'status:', confirmedOrder.status);
              
              // Update status to completed after successful confirmation
              updatedOrder = await storage.updateOrder(orderId, {
                status: 'completed',
              });
              
              console.log('[WINNER ORDER] Order successfully submitted to Printful!');
            } catch (confirmError: any) {
              console.error('[WINNER ORDER] Confirmation failed but order created. Printful ID:', printfulOrder.id, 'Error:', confirmError.message);
              // Order exists in Printful but confirmation failed - ops can manually confirm
              updatedOrder = await storage.updateOrder(orderId, {
                status: 'pending_confirmation',
              });
            }
          } else {
            console.error('[WINNER ORDER] Product has no printfulSyncProductId');
          }
        } catch (printfulError: any) {
          console.error('[WINNER ORDER] Printful error (order still saved locally):', printfulError.message);
          // Order creation failed - update status to indicate the issue
          updatedOrder = await storage.updateOrder(orderId, {
            status: 'printful_error',
          });
        }
      }
      
      res.json(updatedOrder);
    } catch (error: any) {
      console.error("Error submitting shipping info:", error);
      res.status(500).json({ message: "Error submitting shipping info: " + error.message });
    }
  });

  // Admin-only endpoint to preview shirt designs with custom text
  // SECURITY: Only admins can access this to prevent abuse
  // NOTE: SVG generation is a local operation - it doesn't require Printful API
  app.get('/api/admin/design-preview', requireAdmin, async (req: any, res: any) => {
    try {
      console.log('[ADMIN PREVIEW] Request received:', { 
        quote: req.query.quote?.substring(0, 30), 
        author: req.query.author,
        color: req.query.color,
        isPrintfulConfigured 
      });
      
      const quoteText = req.query.quote as string;
      const author = req.query.author as string || 'Anonymous';
      const textColor = (req.query.color as string) || 'white';
      
      if (!quoteText) {
        console.log('[ADMIN PREVIEW] No quote text provided');
        return res.status(400).json({ message: 'Quote text is required' });
      }
      
      if (textColor !== 'white' && textColor !== 'gold') {
        console.log('[ADMIN PREVIEW] Invalid text color:', textColor);
        return res.status(400).json({ message: 'Invalid text color. Use "white" or "gold"' });
      }
      
      // Limit quote length to prevent abuse
      const truncatedQuote = quoteText.substring(0, 500);
      const truncatedAuthor = author.substring(0, 100);
      
      // Generate the SVG design (this is a LOCAL operation, doesn't need Printful API)
      console.log('[ADMIN PREVIEW] Generating SVG design...');
      const svg = await printfulService.generateDesignSVGPublic(
        truncatedQuote, 
        truncatedAuthor, 
        textColor as 'white' | 'gold'
      );
      
      console.log('[ADMIN PREVIEW] SVG generated successfully, length:', svg.length);
      
      // Return as SVG
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(svg);
    } catch (error: any) {
      console.error('[ADMIN PREVIEW] Error generating design preview:', error);
      res.status(500).json({ message: 'Error generating design preview: ' + error.message });
    }
  });

  // Admin endpoint to debug Printful variants and verify correct IDs
  app.get('/api/admin/printful-debug', requireAdmin, async (req: any, res: any) => {
    try {
      console.log('[ADMIN] Fetching Printful debug info...');
      
      // Get catalog variants (the correct black IDs from Printful)
      const catalogInfo = await printfulService.getCatalogVariants(71);
      
      // Get store products (what's actually in our store)
      const storeInfo = await printfulService.getStoreProducts();
      
      res.json({
        message: 'Printful debug information',
        catalog: {
          product: catalogInfo.product,
          blackVariantIds: catalogInfo.blackVariants.map((v: any) => ({
            id: v.variant_id,
            size: v.size,
            color: v.color
          })),
          totalVariants: catalogInfo.allVariantsCount,
        },
        store: storeInfo,
        codeConfig: {
          variantsInCode: [4016, 4017, 4018, 4019, 4020],
          note: 'These are the variant IDs currently configured in the code (S, M, L, XL, 2XL)'
        }
      });
    } catch (error: any) {
      console.error('[ADMIN] Printful debug error:', error);
      res.status(500).json({ message: 'Error fetching Printful debug info: ' + error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
