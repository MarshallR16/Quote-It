import cron from 'node-cron';
import { storage } from './storage';
import { PrintfulService } from './printful';

const isPrintfulConfigured = !!process.env.PRINTFUL_API_TOKEN;
const printfulService = isPrintfulConfigured ? new PrintfulService() : null;

// Design base URL for Printful - defaults to production domain
// Printful must be able to access designs externally, so this should be a publicly accessible URL
const DESIGN_BASE_URL = process.env.DESIGN_BASE_URL || 'https://quote-it.co';

/**
 * Generate a mockup image for a product using Printful's mockup generator
 * and store the mockup URL in the database
 */
async function generateAndStoreMockup(productId: string, quoteId: string, textColor: 'white' | 'gold'): Promise<string | null> {
  if (!printfulService) {
    console.log('[MOCKUP] Printful not configured, skipping mockup generation');
    return null;
  }

  try {
    const designUrl = `${DESIGN_BASE_URL}/api/designs/${quoteId}/${textColor}`;
    
    console.log(`[MOCKUP] Generating mockup for product ${productId}, design: ${designUrl}`);
    
    // Use variant ID 4018 (L / Black) for mockup - common display size
    const mockupUrl = await printfulService.createMockup(4018, designUrl);
    
    // Update product with mockup URL
    await storage.updateProduct(productId, { imageUrl: mockupUrl });
    
    console.log(`[MOCKUP] Mockup stored for product ${productId}: ${mockupUrl}`);
    return mockupUrl;
  } catch (error: any) {
    console.error(`[MOCKUP] Failed to generate mockup for product ${productId}:`, error.message);
    // Don't throw - mockup generation failure shouldn't break the flow
    return null;
  }
}

export async function selectWeeklyWinner() {
  try {
    console.log('[SCHEDULER] Running weekly winner selection...');
      
      // Get eligible quotes: last 7 days that haven't won yet
      const quotes = await storage.getEligibleQuotes();
      
      if (quotes.length === 0) {
        console.log('[SCHEDULER] No eligible quotes available to select winner');
        throw new Error('No eligible quotes available to select winner');
      }

      // Find quote with highest vote count
      const topQuote = quotes.reduce((max, quote) => 
        quote.voteCount > max.voteCount ? quote : max
      , quotes[0]);

      console.log(`[SCHEDULER] Top quote: "${topQuote.text}" with ${topQuote.voteCount} votes`);

      // Calculate week start/end dates (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
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

      console.log(`[SCHEDULER] Weekly winner created: ${winner.id}`);

      // Declare product variables outside if block so they're accessible for return
      // 3 products: gold (winner), white with author (for sale), white no author (for sale)
      let productWithAuthor: any = null;
      let productNoAuthor: any = null;
      let winnerProduct: any = null;

      // Get author info - use display name for better shirt appearance (always needed for products)
      const author = await storage.getUser(topQuote.authorId);
      const authorName = author 
        ? `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || author.email?.split('@')[0] || 'Anonymous'
        : 'Anonymous';
      
      console.log(`[SCHEDULER] Author for shirt: ${authorName}`);

      // Test Printful connection if configured
      let printfulAvailable = false;
      if (isPrintfulConfigured && printfulService) {
        try {
          console.log('[SCHEDULER] Testing Printful connection before product creation...');
          const connectionTest = await printfulService.testConnection();
          printfulAvailable = connectionTest.success;
          
          if (!printfulAvailable) {
            console.error('[SCHEDULER] Printful connection failed:', connectionTest.message);
            console.log('[SCHEDULER] Will create demo products without Printful sync');
          } else {
            console.log('[SCHEDULER] Printful connection successful:', connectionTest.storeInfo?.name);
          }
        } catch (connError: any) {
          console.error('[SCHEDULER] Printful connection test error:', connError.message);
          printfulAvailable = false;
        }
      } else {
        console.log('[SCHEDULER] Printful not configured, will create demo products');
      }

      // Helper to truncate quote text for product names
      const truncatedQuote = `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}"`;

      // ALWAYS create 3 products - try Printful first if available, fallback to demo
      try {
          // =================================================================
          // PRODUCT 1: WHITE text WITH author (for store purchase)
          // =================================================================
          console.log('[SCHEDULER] Creating white text product WITH author for store...');
          
          if (printfulAvailable && printfulService) {
            try {
              const printfulProduct = await printfulService.createProduct(
                topQuote.text,
                authorName,
                `quote-${topQuote.id}-white-author`,
                'white',
                topQuote.id,
                true // includeAuthor = true
              );

              productWithAuthor = await storage.createProduct({
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `${truncatedQuote} - With Attribution`,
                description: `Quote by ${authorName}`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: printfulProduct.id,
                printfulSyncVariants: printfulProduct,
                isActive: true,
              });
              console.log(`[SCHEDULER] White+author product created with Printful: ${productWithAuthor.id}`);
            } catch (printfulError: any) {
              console.error('[SCHEDULER] Printful white+author creation failed:', printfulError.message);
              productWithAuthor = await storage.createProduct({
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `${truncatedQuote} - With Attribution`,
                description: `Quote by ${authorName}`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: null,
                printfulSyncVariants: null,
                isActive: true,
              });
              console.log(`[SCHEDULER] Demo white+author product created: ${productWithAuthor.id}`);
            }
          } else {
            productWithAuthor = await storage.createProduct({
              quoteId: topQuote.id,
              weeklyWinnerId: winner.id,
              name: `${truncatedQuote} - With Attribution`,
              description: `Quote by ${authorName}`,
              price: '29.99',
              imageUrl: null,
              printfulSyncProductId: null,
              printfulSyncVariants: null,
              isActive: true,
            });
            console.log(`[SCHEDULER] Demo white+author product created: ${productWithAuthor.id}`);
          }

          // =================================================================
          // PRODUCT 2: WHITE text WITHOUT author (for store purchase)
          // =================================================================
          console.log('[SCHEDULER] Creating white text product WITHOUT author for store...');
          
          if (printfulAvailable && printfulService) {
            try {
              const printfulProductNoAuthor = await printfulService.createProduct(
                topQuote.text,
                '', // No author
                `quote-${topQuote.id}-white-noauthor`,
                'white',
                topQuote.id,
                false // includeAuthor = false
              );

              productNoAuthor = await storage.createProduct({
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `${truncatedQuote} - Quote Only`,
                description: `Weekly Winner Quote (no attribution)`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: printfulProductNoAuthor.id,
                printfulSyncVariants: printfulProductNoAuthor,
                isActive: true,
              });
              console.log(`[SCHEDULER] White no-author product created with Printful: ${productNoAuthor.id}`);
            } catch (printfulError: any) {
              console.error('[SCHEDULER] Printful white no-author creation failed:', printfulError.message);
              productNoAuthor = await storage.createProduct({
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `${truncatedQuote} - Quote Only`,
                description: `Weekly Winner Quote (no attribution)`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: null,
                printfulSyncVariants: null,
                isActive: true,
              });
              console.log(`[SCHEDULER] Demo white no-author product created: ${productNoAuthor.id}`);
            }
          } else {
            productNoAuthor = await storage.createProduct({
              quoteId: topQuote.id,
              weeklyWinnerId: winner.id,
              name: `${truncatedQuote} - Quote Only`,
              description: `Weekly Winner Quote (no attribution)`,
              price: '29.99',
              imageUrl: null,
              printfulSyncProductId: null,
              printfulSyncVariants: null,
              isActive: true,
            });
            console.log(`[SCHEDULER] Demo white no-author product created: ${productNoAuthor.id}`);
          }

          // =================================================================
          // PRODUCT 3: GOLD text WITH author (exclusive for winner)
          // =================================================================
          console.log('[SCHEDULER] Creating gold text product for winner...');
          
          if (printfulAvailable && printfulService) {
            try {
              const printfulWinnerProduct = await printfulService.createProduct(
                topQuote.text,
                authorName,
                `quote-${topQuote.id}-gold`,
                'gold',
                topQuote.id,
                true // includeAuthor = true
              );

              winnerProduct = await storage.createProduct({
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `${truncatedQuote} (Winner's Gold Edition)`,
                description: `Quote by ${authorName} - Exclusive Winner's Edition with Gold Text`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: printfulWinnerProduct.id,
                printfulSyncVariants: printfulWinnerProduct,
                isActive: false, // Not for sale - winner exclusive
              });
              console.log(`[SCHEDULER] Gold text product created with Printful: ${winnerProduct.id}`);
            } catch (printfulWinnerError: any) {
              console.error('[SCHEDULER] Printful gold product creation failed:', printfulWinnerError.message);
              winnerProduct = await storage.createProduct({
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `${truncatedQuote} (Winner's Gold Edition)`,
                description: `Quote by ${authorName} - Exclusive Winner's Edition`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: null,
                printfulSyncVariants: null,
                isActive: false, // Not for sale - winner exclusive
              });
              console.log(`[SCHEDULER] Demo winner product created: ${winnerProduct.id}`);
            }
          } else {
            winnerProduct = await storage.createProduct({
              quoteId: topQuote.id,
              weeklyWinnerId: winner.id,
              name: `${truncatedQuote} (Winner's Gold Edition)`,
              description: `Quote by ${authorName} - Exclusive Winner's Edition`,
              price: '29.99',
              imageUrl: null,
              printfulSyncProductId: null,
              printfulSyncVariants: null,
              isActive: false, // Not for sale - winner exclusive
            });
            console.log(`[SCHEDULER] Demo winner product created: ${winnerProduct.id}`);
          }

          // Update weekly winner with product IDs (use first active product as primary)
          const primaryProduct = productWithAuthor || productNoAuthor;
          if (primaryProduct) {
            await storage.updateWeeklyWinner(winner.id, {
              productId: primaryProduct.id,
              winnerProductId: winnerProduct?.id || null,
            });
          }

          // Create complimentary order for the winner (gold product)
          const orderProduct = winnerProduct || productWithAuthor;
          if (orderProduct) {
            try {
              const complimentaryOrder = await storage.createOrder({
                userId: topQuote.authorId,
                productId: orderProduct.id,
                amount: '0.00',
                status: 'awaiting_address',
                isComplimentary: true,
                includeAuthor: true,
              });
              console.log('[SCHEDULER] Created complimentary order for winner:', complimentaryOrder.id, 
                winnerProduct ? '(gold edition)' : '(white edition fallback)');
            } catch (error: any) {
              console.error('[SCHEDULER] Error creating complimentary order:', error.message);
            }
          } else {
            console.error('[SCHEDULER] Cannot create complimentary order - no product available');
          }
      } catch (error: any) {
        console.error('[SCHEDULER] Error creating products:', error.message);
        // Even on error, try to create at minimum a demo product if we don't have one
        if (!productWithAuthor && !productNoAuthor) {
          try {
            console.log('[SCHEDULER] Attempting to create demo product after error...');
            productWithAuthor = await storage.createProduct({
              quoteId: topQuote.id,
              weeklyWinnerId: winner.id,
              name: `${truncatedQuote}`,
              description: `Weekly Winner - Quote by ${authorName}`,
              price: '29.99',
              imageUrl: null,
              printfulSyncProductId: null,
              printfulSyncVariants: null,
              isActive: true,
            });
            console.log(`[SCHEDULER] Emergency demo product created: ${productWithAuthor.id}`);
            await storage.updateWeeklyWinner(winner.id, { productId: productWithAuthor.id });
          } catch (demoError: any) {
            console.error('[SCHEDULER] Failed to create emergency demo product:', demoError.message);
          }
        }
      }

      console.log('[SCHEDULER] Weekly winner selection completed successfully');
      console.log(`[SCHEDULER] Products created: white+author=${productWithAuthor?.id}, white-noauthor=${productNoAuthor?.id}, gold=${winnerProduct?.id}`);
      
      // Return full data for frontend display
      return { 
        success: true, 
        winner,
        quote: topQuote,
        product: productWithAuthor || productNoAuthor || null,
        productNoAuthor: productNoAuthor || null,
        winnerProduct: winnerProduct || null
      };
    } catch (error: any) {
      console.error('[SCHEDULER] Error selecting weekly winner:', error.message);
      throw error;
    }
}

async function autoHealWeeklyWinnerProducts() {
  try {
    console.log('[SCHEDULER] Checking for weekly winners without products...');
    
    // First, fix any products with broken image URLs (local file paths don't work in production)
    const allProducts = await storage.getAllProducts();
    for (const product of allProducts) {
      if (product.imageUrl && product.imageUrl.includes('/attached_assets/')) {
        console.log('[SCHEDULER] Fixing broken image URL for product:', product.id);
        await storage.updateProduct(product.id, { imageUrl: null });
        console.log('[SCHEDULER] Fixed image URL - set to null for fallback');
      }
    }
    
    // Get most recent weekly winner with details
    const winner = await storage.getMostRecentWeeklyWinnerWithDetails();
    
    if (!winner) {
      console.log('[SCHEDULER] No weekly winners found');
      return;
    }
    
    // Get all products for this weekly winner
    const winnerProducts = allProducts.filter(p => p.weeklyWinnerId === winner.winnerId);
    console.log(`[SCHEDULER] Found ${winnerProducts.length} products for winner ${winner.winnerId}`);
    
    // Check if gold product exists (name contains "Gold Edition")
    const hasGoldProduct = winnerProducts.some(p => p.name.includes('Gold Edition'));
    
    // Check if winner has basic products
    const hasBasicProduct = winnerProducts.some(p => !p.name.includes('Gold Edition'));
    
    // Get author info for product creation
    const author = await storage.getUser(winner.authorId);
    const authorName = author 
      ? `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username || author.email?.split('@')[0] || 'Anonymous'
      : winner.authorUsername || 'Anonymous';
    
    const truncatedQuote = `"${winner.quoteText.substring(0, 50)}${winner.quoteText.length > 50 ? '...' : ''}"`;
    
    // Track the gold product (existing or newly created)
    let goldProductId: string | null = null;
    
    // Create missing gold product for winner
    if (!hasGoldProduct) {
      console.log(`[SCHEDULER] Weekly winner ${winner.winnerId} is MISSING gold product - creating now...`);
      
      let goldProduct = null;
      
      // Try to create with Printful if configured
      if (isPrintfulConfigured && printfulService) {
        try {
          console.log('[SCHEDULER] Testing Printful connection for gold product creation...');
          const connectionTest = await printfulService.testConnection();
          
          if (connectionTest.success) {
            console.log('[SCHEDULER] Printful available, creating gold product...');
            const printfulGoldProduct = await printfulService.createProduct(
              winner.quoteText,
              authorName,
              `quote-${winner.quoteId}-gold`,
              'gold',
              winner.quoteId,
              true // includeAuthor = true
            );
            
            goldProduct = await storage.createProduct({
              quoteId: winner.quoteId,
              weeklyWinnerId: winner.winnerId,
              name: `${truncatedQuote} (Winner's Gold Edition)`,
              description: `Quote by ${authorName} - Exclusive Winner's Edition with Gold Text`,
              price: '29.99',
              imageUrl: null,
              printfulSyncProductId: printfulGoldProduct.id,
              printfulSyncVariants: printfulGoldProduct,
              isActive: false, // Not for sale - winner exclusive
            });
            console.log(`[SCHEDULER] Created gold product with Printful: ${goldProduct.id}`);
          } else {
            console.log('[SCHEDULER] Printful unavailable, creating demo gold product...');
          }
        } catch (printfulError: any) {
          console.error('[SCHEDULER] Printful gold product creation failed:', printfulError.message);
        }
      }
      
      // Fallback: create demo gold product if Printful failed
      if (!goldProduct) {
        goldProduct = await storage.createProduct({
          quoteId: winner.quoteId,
          weeklyWinnerId: winner.winnerId,
          name: `${truncatedQuote} (Winner's Gold Edition)`,
          description: `Quote by ${authorName} - Exclusive Winner's Edition with Gold Text`,
          price: '29.99',
          imageUrl: null,
          printfulSyncProductId: null,
          printfulSyncVariants: null,
          isActive: false, // Not for sale - winner exclusive
        });
        console.log(`[SCHEDULER] Created demo gold product: ${goldProduct.id}`);
      }
      
      goldProductId = goldProduct.id;
      
      // Update winner with gold product ID
      await storage.updateWeeklyWinner(winner.winnerId, { winnerProductId: goldProduct.id });
      console.log('[SCHEDULER] Updated weekly winner with gold product ID');
    } else {
      console.log('[SCHEDULER] Gold product already exists for this winner');
      // Get the existing gold product ID
      const existingGoldProduct = winnerProducts.find(p => p.name.includes('Gold Edition'));
      goldProductId = existingGoldProduct?.id || null;
    }
    
    // Always check for complimentary order - runs even if gold product already existed
    if (goldProductId) {
      const existingOrders = await storage.getOrdersByUser(winner.authorId);
      const hasComplimentaryOrder = existingOrders.some(o => o.isComplimentary && o.productId === goldProductId);
      
      if (!hasComplimentaryOrder) {
        try {
          const complimentaryOrder = await storage.createOrder({
            userId: winner.authorId,
            productId: goldProductId,
            amount: '0.00',
            status: 'awaiting_address',
            isComplimentary: true,
            includeAuthor: true,
          });
          console.log('[SCHEDULER] Created complimentary order for winner:', complimentaryOrder.id);
        } catch (orderError: any) {
          console.error('[SCHEDULER] Error creating complimentary order:', orderError.message);
        }
      } else {
        console.log('[SCHEDULER] Winner already has a complimentary order');
      }
    }
    
    // Also ensure winner has at least one basic product
    if (!hasBasicProduct) {
      console.log(`[SCHEDULER] Weekly winner ${winner.winnerId} has no basic product - creating demo product...`);
      
      const basicProduct = await storage.createProduct({
        quoteId: winner.quoteId,
        weeklyWinnerId: winner.winnerId,
        name: `${truncatedQuote} - With Attribution`,
        description: `Quote by ${authorName}`,
        price: '29.99',
        imageUrl: null,
        printfulSyncProductId: null,
        printfulSyncVariants: null,
        isActive: true,
      });
      console.log('[SCHEDULER] Created demo basic product:', basicProduct.id);
      
      // Update winner with product ID if not set
      if (!winner.productId) {
        await storage.updateWeeklyWinner(winner.winnerId, { productId: basicProduct.id });
        console.log('[SCHEDULER] Updated weekly winner with basic product ID');
      }
    }
    
    console.log('[SCHEDULER] Auto-heal completed');
    
  } catch (error: any) {
    console.error('[SCHEDULER] Error in auto-heal:', error.message);
  }
}

export function startWeeklyWinnerScheduler() {
  // Run every Sunday at 11:59 PM (just before week ends)
  // Cron format: minute hour day-of-month month day-of-week
  // 59 23 * * 0 = 11:59 PM on Sundays
  cron.schedule('59 23 * * 0', async () => {
    await selectWeeklyWinner();
  });

  console.log('[SCHEDULER] Weekly winner cron job initialized (runs every Sunday at 11:59 PM)');
  
  // Auto-heal: Check if most recent weekly winner has products, create if missing
  setTimeout(() => {
    autoHealWeeklyWinnerProducts();
  }, 5000); // Wait 5 seconds after startup to ensure DB is ready
}
