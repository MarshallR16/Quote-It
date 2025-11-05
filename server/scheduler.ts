import cron from 'node-cron';
import { storage } from './storage';
import { PrintfulService } from './printful';

const isPrintfulConfigured = !!process.env.PRINTFUL_API_TOKEN;
const printfulService = isPrintfulConfigured ? new PrintfulService() : null;

export function startWeeklyWinnerScheduler() {
  // Run every Sunday at 11:59 PM (just before week ends)
  // Cron format: minute hour day-of-month month day-of-week
  // 59 23 * * 0 = 11:59 PM on Sundays
  cron.schedule('59 23 * * 0', async () => {
    try {
      console.log('[SCHEDULER] Running weekly winner selection...');
      
      // Get all quotes
      const quotes = await storage.getAllQuotes();
      
      if (quotes.length === 0) {
        console.log('[SCHEDULER] No quotes available to select winner');
        return;
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

      // Automatically create Printful product if configured
      if (isPrintfulConfigured && printfulService) {
        try {
          // Get author info
          const author = await storage.getUser(topQuote.authorId);
          const authorName = author?.email?.split('@')[0] || 'unknown';

          console.log('[SCHEDULER] Creating Printful product...');
          const printfulProduct = await printfulService.createProduct(
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

          const product = await storage.createProduct(productData);
          console.log(`[SCHEDULER] Printful product created successfully: ${product.id}`);
        } catch (error: any) {
          console.error('[SCHEDULER] Error creating Printful product:', error.message);
        }
      } else {
        console.log('[SCHEDULER] Printful not configured, skipping product creation');
      }

      console.log('[SCHEDULER] Weekly winner selection completed successfully');
    } catch (error: any) {
      console.error('[SCHEDULER] Error selecting weekly winner:', error.message);
    }
  });

  console.log('[SCHEDULER] Weekly winner cron job initialized (runs every Sunday at 11:59 PM)');
}
