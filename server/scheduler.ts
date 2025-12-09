import cron from 'node-cron';
import { storage } from './storage';
import { PrintfulService } from './printful';

const isPrintfulConfigured = !!process.env.PRINTFUL_API_TOKEN;
const printfulService = isPrintfulConfigured ? new PrintfulService() : null;

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
      let product: any = null;
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

      // ALWAYS create products - try Printful first if available, fallback to demo
      try {

          // Create WHITE text version (for store)
          console.log('[SCHEDULER] Creating white text product for store...');
          let printfulProduct = null;
          
          if (printfulAvailable && printfulService) {
            // Try to create via Printful
            try {
              printfulProduct = await printfulService.createProduct(
                topQuote.text,
                authorName,
                `quote-${topQuote.id}-white`,
                'white',
                topQuote.id
              );

              // Create product in database with Printful data
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
              console.log(`[SCHEDULER] White text product created with Printful: ${product.id}`);
            } catch (printfulError: any) {
              // If Printful fails, create a demo product anyway so store isn't empty
              console.error('[SCHEDULER] Printful creation failed:', printfulError.message);
              console.error('[SCHEDULER] Printful error details:', printfulError.response?.data || 'No additional details');
              console.log('[SCHEDULER] Creating demo product anyway...');
              const productData = {
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}"`,
                description: `Weekly Winner - Quote by ${authorName}`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: null,
                printfulSyncVariants: null,
                isActive: true,
              };

              product = await storage.createProduct(productData);
              console.log(`[SCHEDULER] Demo product created: ${product.id}`);
            }
          } else {
            // No Printful connection - create demo product directly
            console.log('[SCHEDULER] Creating demo product (no Printful connection)...');
            const productData = {
              quoteId: topQuote.id,
              weeklyWinnerId: winner.id,
              name: `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}"`,
              description: `Weekly Winner - Quote by ${authorName}`,
              price: '29.99',
              imageUrl: null,
              printfulSyncProductId: null,
              printfulSyncVariants: null,
              isActive: true,
            };

            product = await storage.createProduct(productData);
            console.log(`[SCHEDULER] Demo product created: ${product.id}`);
          }

          // Create GOLD text version (exclusive for winner)
          console.log('[SCHEDULER] Creating gold text product for winner...');
          let printfulWinnerProduct = null;
          
          if (printfulAvailable && printfulService) {
            try {
              printfulWinnerProduct = await printfulService.createProduct(
                topQuote.text,
                authorName,
                `quote-${topQuote.id}-gold`,
                'gold',
                topQuote.id
              );

              // Create winner's exclusive product in database
              const winnerProductData = {
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}" (Winner's Gold Edition)`,
                description: `Quote by ${authorName} - Exclusive Winner's Edition with Gold Text`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: printfulWinnerProduct.id,
                printfulSyncVariants: printfulWinnerProduct,
                isActive: false, // Not for sale - winner exclusive
              };

              winnerProduct = await storage.createProduct(winnerProductData);
              console.log(`[SCHEDULER] Gold text product created with Printful: ${winnerProduct.id}`);
            } catch (printfulWinnerError: any) {
              // If Printful fails for winner product, create demo anyway
              console.error('[SCHEDULER] Printful gold product creation failed:', printfulWinnerError.message);
              console.error('[SCHEDULER] Printful gold error details:', printfulWinnerError.response?.data || 'No additional details');
              console.log('[SCHEDULER] Creating demo gold product anyway...');
              const winnerProductData = {
                quoteId: topQuote.id,
                weeklyWinnerId: winner.id,
                name: `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}" (Winner's Gold Edition)`,
                description: `Quote by ${authorName} - Exclusive Winner's Edition`,
                price: '29.99',
                imageUrl: null,
                printfulSyncProductId: null,
                printfulSyncVariants: null,
                isActive: false, // Not for sale - winner exclusive
              };

              winnerProduct = await storage.createProduct(winnerProductData);
              console.log(`[SCHEDULER] Demo winner product created: ${winnerProduct.id}`);
            }
          } else {
            // No Printful connection - create demo gold product directly
            console.log('[SCHEDULER] Creating demo gold product (no Printful connection)...');
            const winnerProductData = {
              quoteId: topQuote.id,
              weeklyWinnerId: winner.id,
              name: `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}" (Winner's Gold Edition)`,
              description: `Quote by ${authorName} - Exclusive Winner's Edition`,
              price: '29.99',
              imageUrl: null,
              printfulSyncProductId: null,
              printfulSyncVariants: null,
              isActive: false, // Not for sale - winner exclusive
            };

            winnerProduct = await storage.createProduct(winnerProductData);
            console.log(`[SCHEDULER] Demo winner product created: ${winnerProduct.id}`);
          }

          // Update weekly winner with both product IDs
          if (product && winnerProduct) {
            await storage.updateWeeklyWinner(winner.id, {
              productId: product.id,
              winnerProductId: winnerProduct.id,
            });
          }

          // Create complimentary order for the winner
          // Use gold product if available, otherwise fall back to white product
          const orderProduct = winnerProduct || product;
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
        if (!product) {
          try {
            console.log('[SCHEDULER] Attempting to create demo product after error...');
            const demoProductData = {
              quoteId: topQuote.id,
              weeklyWinnerId: winner.id,
              name: `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}"`,
              description: `Weekly Winner - Quote by ${authorName}`,
              price: '29.99',
              imageUrl: null,
              printfulSyncProductId: null,
              printfulSyncVariants: null,
              isActive: true,
            };
            product = await storage.createProduct(demoProductData);
            console.log(`[SCHEDULER] Emergency demo product created: ${product.id}`);
            await storage.updateWeeklyWinner(winner.id, { productId: product.id });
          } catch (demoError: any) {
            console.error('[SCHEDULER] Failed to create emergency demo product:', demoError.message);
          }
        }
      }

      console.log('[SCHEDULER] Weekly winner selection completed successfully');
      
      // Return full data for frontend display
      return { 
        success: true, 
        winner,
        quote: topQuote,
        product: product || null,
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
    
    // Check if winner has an active product
    if (winner.productId) {
      console.log('[SCHEDULER] Most recent weekly winner already has a product');
      return;
    }
    
    console.log(`[SCHEDULER] Weekly winner ${winner.winnerId} has no product - creating demo product...`);
    
    // Create demo product for this winner (imageUrl null so frontend uses built-in fallback)
    const productData = {
      quoteId: winner.quoteId,
      weeklyWinnerId: winner.winnerId,
      name: `"${winner.quoteText.substring(0, 50)}${winner.quoteText.length > 50 ? '...' : ''}"`,
      description: `Weekly Winner - Quote by ${winner.authorUsername || 'unknown'}`,
      price: '29.99',
      imageUrl: null,
      printfulProductId: null,
      printfulSyncProductId: null,
      isActive: true,
    };
    
    const product = await storage.createProduct(productData);
    console.log('[SCHEDULER] Created demo product for weekly winner:', product.id);
    
    // Update the weekly winner with the product ID
    await storage.updateWeeklyWinner(winner.winnerId, { productId: product.id });
    console.log('[SCHEDULER] Updated weekly winner with product ID');
    
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
