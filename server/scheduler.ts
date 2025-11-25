import cron from 'node-cron';
import { storage } from './storage';
import { PrintfulService } from './printful';

const isPrintfulConfigured = !!process.env.PRINTFUL_API_TOKEN;
const printfulService = isPrintfulConfigured ? new PrintfulService() : null;

export async function selectWeeklyWinner() {
  try {
    console.log('[SCHEDULER] Running weekly winner selection...');
      
      // Get all quotes
      const quotes = await storage.getAllQuotes();
      
      if (quotes.length === 0) {
        console.log('[SCHEDULER] No quotes available to select winner');
        throw new Error('No quotes available to select winner');
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

      // Automatically create Printful products if configured
      if (isPrintfulConfigured && printfulService) {
        try {
          // Get author info
          const author = await storage.getUser(topQuote.authorId);
          const authorName = author?.email?.split('@')[0] || 'unknown';

          // Create WHITE text version (for store)
          console.log('[SCHEDULER] Creating white text product for store...');
          let printfulProduct = null;
          let product = null;
          
          try {
            printfulProduct = await printfulService.createProduct(
              topQuote.text,
              authorName,
              `quote-${topQuote.id}-white`,
              'white'
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
            console.log('[SCHEDULER] Printful creation failed, creating demo product anyway...');
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
          let winnerProduct = null;
          
          try {
            printfulWinnerProduct = await printfulService.createProduct(
              topQuote.text,
              authorName,
              `quote-${topQuote.id}-gold`,
              'gold'
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
            console.log('[SCHEDULER] Printful gold product creation failed, creating demo anyway...');
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

          // Create complimentary order for the winner using GOLD text version
          if (winnerProduct) {
            try {
              const complimentaryOrder = await storage.createOrder({
                userId: topQuote.authorId,
                productId: winnerProduct.id, // Use gold text version
                amount: '0.00',
                status: 'awaiting_address',
                isComplimentary: true,
                includeAuthor: true,
              });
              console.log('[SCHEDULER] Created complimentary order with gold text for winner:', complimentaryOrder.id);
            } catch (error: any) {
              console.error('[SCHEDULER] Error creating complimentary order:', error.message);
            }
          }
        } catch (error: any) {
          console.error('[SCHEDULER] Error creating Printful product:', error.message);
        }
      } else {
        console.log('[SCHEDULER] Printful not configured, skipping product creation');
      }

      console.log('[SCHEDULER] Weekly winner selection completed successfully');
      return { success: true, winner };
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
