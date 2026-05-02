import cron from 'node-cron';
import { storage, isoWeekId } from './storage';
import { PrintfulService } from './printful';

// Window during which a winner can claim their free gold tee before it expires.
const PRIZE_CLAIM_WINDOW_DAYS = 14;

const isPrintfulConfigured = !!process.env.PRINTFUL_API_TOKEN;
const printfulService = isPrintfulConfigured ? new PrintfulService() : null;

// Design base URL for Printful - defaults to production domain
// Printful must be able to access designs externally, so this should be a publicly accessible URL
const DESIGN_BASE_URL = process.env.DESIGN_BASE_URL || 'https://quote-it.co';

/**
 * Parse Printful external_id to extract quoteId and product type
 */
function parseExternalId(externalId: string): { quoteId: string; type: 'gold' | 'white-author' | 'white-noauthor' } | null {
  if (!externalId || !externalId.startsWith('quote-')) {
    return null;
  }
  
  const withoutPrefix = externalId.substring(6); // Remove 'quote-'
  
  if (withoutPrefix.endsWith('-gold')) {
    return { quoteId: withoutPrefix.slice(0, -5), type: 'gold' };
  } else if (withoutPrefix.endsWith('-white-noauthor')) {
    return { quoteId: withoutPrefix.slice(0, -15), type: 'white-noauthor' };
  } else if (withoutPrefix.endsWith('-white-author')) {
    return { quoteId: withoutPrefix.slice(0, -13), type: 'white-author' };
  } else if (withoutPrefix.endsWith('-white')) {
    // Legacy format - treat as white with author
    return { quoteId: withoutPrefix.slice(0, -6), type: 'white-author' };
  }
  
  return null;
}

/**
 * Normalize text for comparison - removes quotes, extra spaces, lowercases
 */
function normalizeQuoteText(text: string): string {
  return text
    .toLowerCase()
    .replace(/["""'']/g, '') // Remove various quote characters
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim()
    .substring(0, 50);        // Compare first 50 chars only
}

/**
 * Determine product type from Printful product name
 */
function getProductTypeFromName(name: string): 'gold' | 'white-author' | 'white-noauthor' {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('gold')) {
    return 'gold';
  } else if (nameLower.includes('quote only') || nameLower.includes('no author') || nameLower.includes('without author')) {
    return 'white-noauthor';
  }
  return 'white-author';
}

/**
 * Reconcile Printful products with database - imports missing products and fixes sync IDs
 * This runs on startup and can be called manually to ensure data consistency
 */
export async function reconcilePrintfulProducts(): Promise<{ fixed: number; created: number; errors: string[] }> {
  const result = { fixed: 0, created: 0, errors: [] as string[] };
  
  if (!printfulService) {
    console.log('[RECONCILE] Printful not configured, skipping reconciliation');
    return result;
  }
  
  try {
    console.log('[RECONCILE] Starting Printful product reconciliation...');
    
    // Get all Printful products
    const printfulProducts = await printfulService.listProducts();
    console.log(`[RECONCILE] Found ${printfulProducts.length} products in Printful`);
    
    // Get all database products
    const dbProducts = await storage.getAllProducts();
    console.log(`[RECONCILE] Found ${dbProducts.length} products in database`);
    
    // Get all quotes for text matching
    const allQuotes = await storage.getAllQuotes();
    console.log(`[RECONCILE] Loaded ${allQuotes.length} quotes for text matching`);
    
    // Build a map of normalized quote text to quote for matching
    const quotesByNormalizedText = new Map<string, typeof allQuotes[0]>();
    for (const quote of allQuotes) {
      const normalized = normalizeQuoteText(quote.text);
      if (!quotesByNormalizedText.has(normalized)) {
        quotesByNormalizedText.set(normalized, quote);
      }
    }
    
    // Build a map of database products by quote_id + type for quick lookup
    const dbProductKey = (quoteId: string, type: string) => `${quoteId}:${type}`;
    const dbProductsByKey = new Map<string, typeof dbProducts[0]>();
    
    for (const product of dbProducts) {
      const type = getProductTypeFromName(product.name);
      const key = dbProductKey(product.quoteId, type);
      // Keep first match (shouldn't have duplicates, but just in case)
      if (!dbProductsByKey.has(key)) {
        dbProductsByKey.set(key, product);
      }
    }
    
    // Process each Printful product
    for (const pfProduct of printfulProducts) {
      let parsed = parseExternalId(pfProduct.external_id);
      
      // If no valid external_id, try to match by product name containing quote text
      if (!parsed) {
        console.log(`[RECONCILE] Product ${pfProduct.id} has no external_id, attempting to match by quote text...`);
        
        // Extract quote text from product name (format: "Quote text..." or similar)
        const productName = pfProduct.name || '';
        const type = getProductTypeFromName(productName);
        
        // Try to find a matching quote by comparing text in the product name
        let matchedQuote: typeof allQuotes[0] | undefined;
        for (const quote of allQuotes) {
          const quoteSnippet = quote.text.substring(0, 30).toLowerCase();
          if (productName.toLowerCase().includes(quoteSnippet)) {
            matchedQuote = quote;
            break;
          }
        }
        
        if (matchedQuote) {
          console.log(`[RECONCILE] Matched Printful product "${productName.substring(0, 40)}..." to quote ${matchedQuote.id}`);
          
          // Build the correct external_id
          const correctExternalId = `quote-${matchedQuote.id}-${type}`;
          
          // Update the Printful product with the correct external_id
          try {
            await printfulService.updateProductExternalId(pfProduct.id, correctExternalId);
            console.log(`[RECONCILE] Updated Printful product ${pfProduct.id} with external_id: ${correctExternalId}`);
            
            // Now we can process it with the correct external_id
            parsed = { quoteId: matchedQuote.id, type };
          } catch (updateError: any) {
            console.error(`[RECONCILE] Failed to update external_id for product ${pfProduct.id}: ${updateError.message}`);
            result.errors.push(`Failed to update external_id for ${pfProduct.id}: ${updateError.message}`);
            continue;
          }
        } else {
          console.log(`[RECONCILE] Could not match product "${productName.substring(0, 40)}..." to any quote, skipping`);
          continue;
        }
      }
      
      const { quoteId, type } = parsed;
      console.log(`[RECONCILE] Processing: ${pfProduct.external_id} -> quoteId: ${quoteId}, type: ${type}`);
      
      // Check if we have a matching product in database
      const key = dbProductKey(quoteId, type);
      const existingProduct = dbProductsByKey.get(key);
      
      if (existingProduct) {
        // Product exists - update sync ID if missing
        if (!existingProduct.printfulSyncProductId) {
          console.log(`[RECONCILE] Updating existing product ${existingProduct.id} with Printful sync ID ${pfProduct.id}`);
          try {
            await storage.updateProduct(existingProduct.id, {
              printfulSyncProductId: pfProduct.id,
            });
            result.fixed++;
            console.log(`[RECONCILE] Fixed: ${existingProduct.name} -> Printful ID ${pfProduct.id}`);
          } catch (updateError: any) {
            result.errors.push(`Failed to update ${existingProduct.id}: ${updateError.message}`);
          }
        } else {
          console.log(`[RECONCILE] Product ${existingProduct.id} already has sync ID ${existingProduct.printfulSyncProductId}`);
        }
      } else {
        // Product doesn't exist in database - CREATE it if quote exists
        console.log(`[RECONCILE] No database product found for ${key}, checking if quote exists...`);
        
        const quote = await storage.getQuote(quoteId);
        if (!quote) {
          console.log(`[RECONCILE] Quote ${quoteId} not found in database, skipping product creation`);
          continue;
        }
        
        // Get full product details from Printful (price, variants)
        let productDetails;
        try {
          productDetails = await printfulService.getProductDetails(pfProduct.id);
        } catch (detailError: any) {
          console.log(`[RECONCILE] Failed to get details for Printful product ${pfProduct.id}: ${detailError.message}`);
          result.errors.push(`Failed to get details for ${pfProduct.id}: ${detailError.message}`);
          continue;
        }
        
        // Extract price from first variant (they all have same price)
        const variants = productDetails.sync_variants || [];
        const price = variants[0]?.retail_price || '29.99';
        
        // Build product name and description based on type
        const quotePreview = quote.text.length > 50 ? quote.text.substring(0, 47) + '...' : quote.text;
        let productName: string;
        let productDescription: string;
        let isActive: boolean;
        
        if (type === 'gold') {
          productName = `"${quotePreview}" (Winner's Gold Edition)`;
          productDescription = 'Exclusive winner edition with gold text';
          isActive = false; // Gold editions are not for sale
        } else if (type === 'white-noauthor') {
          productName = `"${quotePreview}" - Quote Only`;
          productDescription = 'Weekly Winner Quote (no attribution)';
          isActive = true;
        } else {
          productName = `"${quotePreview}" - With Attribution`;
          productDescription = 'Weekly Winner Quote with author attribution';
          isActive = true;
        }
        
        // Try to find weekly winner for this quote (to link weeklyWinnerId)
        const weeklyWinner = await storage.getWeeklyWinnerByQuoteId(quoteId);
        
        // Store variant info for order fulfillment
        const syncVariants = variants.map((v: any) => ({
          id: v.id,
          variant_id: v.variant_id,
          size: v.size,
          name: v.name,
          retail_price: v.retail_price,
        }));
        
        // Create the product in database
        try {
          const variant: 'white' | 'gold_winner' = type === 'gold' ? 'gold_winner' : 'white';
          const newProduct = await storage.createProduct({
            quoteId,
            weeklyWinnerId: weeklyWinner?.id || null,
            variant,
            isExclusive: variant === 'gold_winner',
            name: productName,
            description: productDescription,
            price,
            imageUrl: null, // Can generate mockup later
            printfulSyncProductId: pfProduct.id,
            printfulSyncVariants: syncVariants,
            isActive,
          });
          
          result.created++;
          console.log(`[RECONCILE] Created product: ${newProduct.id} (${productName}) -> Printful ID ${pfProduct.id}`);
          
          // Add to our map so we don't create duplicates in this run
          dbProductsByKey.set(key, newProduct);
        } catch (createError: any) {
          result.errors.push(`Failed to create product for ${key}: ${createError.message}`);
          console.error(`[RECONCILE] Failed to create product for ${key}:`, createError.message);
        }
      }
    }
    
    console.log(`[RECONCILE] Reconciliation complete. Created ${result.created} products, fixed ${result.fixed} products.`);
    if (result.errors.length > 0) {
      console.error('[RECONCILE] Errors:', result.errors);
    }
    
  } catch (error: any) {
    console.error('[RECONCILE] Error during reconciliation:', error.message);
    result.errors.push(error.message);
  }
  
  return result;
}

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

      // IMPORTANT: Require at least 1 vote to select a winner
      // This prevents selecting test/demo quotes with 0 votes
      if (topQuote.voteCount < 1) {
        console.log(`[SCHEDULER] Top quote has ${topQuote.voteCount} votes - minimum 1 vote required to select winner`);
        throw new Error('No quotes with votes available to select winner. Minimum 1 vote required.');
      }

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

      // Create weekly winner. weekId/winnerUserId are required and provide:
      //   - weekId: stable ISO-week identifier ("2026-W18") for app-side lookups
      //     and unique constraint (one winner per week)
      //   - winnerUserId: denormalized author for cheap "is this user the winner"
      //     checks without joining quotes -> users
      const winnerWeekId = isoWeekId(weekStart);
      const winner = await storage.createWeeklyWinner({
        quoteId: topQuote.id,
        weekId: winnerWeekId,
        winnerUserId: topQuote.authorId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        finalVoteCount: topQuote.voteCount,
      });

      console.log(`[SCHEDULER] Weekly winner created: ${winner.id} (${winnerWeekId})`);

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

      // Printful is REQUIRED - no demo products ever
      if (!isPrintfulConfigured || !printfulService) {
        throw new Error('Printful is not configured. Cannot create winner products without Printful.');
      }

      // Test Printful connection
      console.log('[SCHEDULER] Testing Printful connection before product creation...');
      const connectionTest = await printfulService.testConnection();
      
      if (!connectionTest.success) {
        throw new Error(`Printful connection failed: ${connectionTest.message}. Will retry on next cron run.`);
      }
      
      console.log('[SCHEDULER] Printful connection successful:', connectionTest.storeInfo?.name);

      // Helper to truncate quote text for product names
      const truncatedQuote = `"${topQuote.text.substring(0, 50)}${topQuote.text.length > 50 ? '...' : ''}"`;

      // Helper to save product to database with retries
      const saveProductWithRetry = async (productData: any, printfulProductId: number, printfulProduct: any, maxRetries = 3): Promise<any> => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const dbProduct = await storage.createProduct({
              ...productData,
              printfulSyncProductId: printfulProductId,
              printfulSyncVariants: printfulProduct,
            });
            return dbProduct;
          } catch (dbError: any) {
            console.error(`[SCHEDULER] DB save attempt ${attempt}/${maxRetries} failed:`, dbError.message);
            if (attempt === maxRetries) {
              throw new Error(`Failed to save product to database after ${maxRetries} attempts: ${dbError.message}`);
            }
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      };

      // =================================================================
      // PRODUCT 1: WHITE text WITH author (for store purchase)
      // =================================================================
      console.log('[SCHEDULER] Creating white text product WITH author for store...');
      
      const printfulProduct = await printfulService.createProduct(
        topQuote.text,
        authorName,
        `quote-${topQuote.id}-white-author`,
        'white',
        topQuote.id,
        true // includeAuthor = true
      );

      productWithAuthor = await saveProductWithRetry({
        quoteId: topQuote.id,
        weeklyWinnerId: winner.id,
        variant: 'white' as const,
        isExclusive: false,
        name: `${truncatedQuote} - With Attribution`,
        description: `Quote by ${authorName}`,
        price: '29.99',
        imageUrl: null,
        isActive: true,
      }, printfulProduct.id, printfulProduct);
      console.log(`[SCHEDULER] White+author product created with Printful: ${productWithAuthor.id}, syncId: ${printfulProduct.id}`);

      // =================================================================
      // PRODUCT 2: WHITE text WITHOUT author (for store purchase)
      // =================================================================
      console.log('[SCHEDULER] Creating white text product WITHOUT author for store...');
      
      const printfulProductNoAuthor = await printfulService.createProduct(
        topQuote.text,
        '', // No author
        `quote-${topQuote.id}-white-noauthor`,
        'white',
        topQuote.id,
        false // includeAuthor = false
      );

      productNoAuthor = await saveProductWithRetry({
        quoteId: topQuote.id,
        weeklyWinnerId: winner.id,
        variant: 'white' as const,
        isExclusive: false,
        name: `${truncatedQuote} - Quote Only`,
        description: `Weekly Winner Quote (no attribution)`,
        price: '29.99',
        imageUrl: null,
        isActive: true,
      }, printfulProductNoAuthor.id, printfulProductNoAuthor);
      console.log(`[SCHEDULER] White no-author product created with Printful: ${productNoAuthor.id}, syncId: ${printfulProductNoAuthor.id}`);

      // =================================================================
      // PRODUCT 3: GOLD text WITH author (exclusive for winner)
      // =================================================================
      console.log('[SCHEDULER] Creating gold text product for winner...');
      
      const printfulWinnerProduct = await printfulService.createProduct(
        topQuote.text,
        authorName,
        `quote-${topQuote.id}-gold`,
        'gold',
        topQuote.id,
        true // includeAuthor = true
      );

      winnerProduct = await saveProductWithRetry({
        quoteId: topQuote.id,
        weeklyWinnerId: winner.id,
        variant: 'gold_winner' as const,
        isExclusive: true,
        name: `${truncatedQuote} (Winner's Gold Edition)`,
        description: `Quote by ${authorName} - Exclusive Winner's Edition with Gold Text`,
        price: '29.99',
        imageUrl: null,
        isActive: false, // Not for sale - winner exclusive
      }, printfulWinnerProduct.id, printfulWinnerProduct);
      console.log(`[SCHEDULER] Gold text product created with Printful: ${winnerProduct.id}, syncId: ${printfulWinnerProduct.id}`);

      // Update weekly winner with product IDs
      await storage.updateWeeklyWinner(winner.id, {
        productId: productWithAuthor.id,
        winnerProductId: winnerProduct.id,
      });

      // Create the prize voucher for the winner. Real `orders` rows are only
      // ever created when the winner submits an address (via /api/prizes/:id/claim).
      try {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + PRIZE_CLAIM_WINDOW_DAYS);
        const prize = await storage.createPrize({
          weeklyWinnerId: winner.id,
          userId: topQuote.authorId,
          productId: winnerProduct.id,
          status: 'unclaimed',
          expiresAt,
        });
        console.log(`[SCHEDULER] Created unclaimed prize for winner: ${prize.id} (expires ${expiresAt.toISOString()})`);
      } catch (error: any) {
        console.error('[SCHEDULER] Error creating prize:', error.message);
        // Don't throw - products were created successfully, prize can be backfilled by autoHeal
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
    console.log('[SCHEDULER] Auto-heal: Checking for weekly winners with missing or unsynced products...');
    
    // First, fix any products with broken image URLs (local file paths don't work in production)
    const allProducts = await storage.getAllProducts();
    for (const product of allProducts) {
      if (product.imageUrl && product.imageUrl.includes('/attached_assets/')) {
        console.log('[SCHEDULER] Fixing broken image URL for product:', product.id);
        await storage.updateProduct(product.id, { imageUrl: null });
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
    
    // Find products with missing sync IDs - these need to be fixed via reconciliation
    const productsNeedingSync = winnerProducts.filter(p => !p.printfulSyncProductId);
    
    if (productsNeedingSync.length > 0) {
      console.log(`[SCHEDULER] ${productsNeedingSync.length} products need Printful sync - reconciliation will fix these`);
      // Reconciliation runs separately and will link these products to Printful
    }
    
    // Find gold product (preferring the new variant column, falling back to name parsing for backfill window)
    const goldProduct = winnerProducts.find(p => p.variant === 'gold_winner')
      ?? winnerProducts.find(p => p.name.includes('Gold Edition'));

    // Make sure the winner has a prize. If a previous run failed, create one;
    // never resurrect expired prizes (winner missed their window).
    if (goldProduct) {
      const existingPrize = await storage.getPrizeByWeeklyWinner(winner.winnerId);

      if (!existingPrize) {
        try {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + PRIZE_CLAIM_WINDOW_DAYS);
          const prize = await storage.createPrize({
            weeklyWinnerId: winner.winnerId,
            userId: winner.authorId,
            productId: goldProduct.id,
            status: 'unclaimed',
            expiresAt,
          });
          console.log('[SCHEDULER] Auto-heal created prize:', prize.id);
        } catch (prizeError: any) {
          console.error('[SCHEDULER] Error creating prize during auto-heal:', prizeError.message);
        }
      } else {
        console.log(`[SCHEDULER] Winner already has prize ${existingPrize.id} (status: ${existingPrize.status})`);
      }
    } else {
      console.log('[SCHEDULER] No gold product found for winner - reconciliation should create it from Printful');
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
  
  // Hourly reconciliation: Sync Printful products with database to fix any sync gaps
  // Cron format: 0 * * * * = every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    console.log('[SCHEDULER] Running hourly Printful reconciliation...');
    try {
      const result = await reconcilePrintfulProducts();
      console.log(`[SCHEDULER] Hourly reconciliation completed: fixed=${result.fixed}, created=${result.created}`);
    } catch (error: any) {
      console.error('[SCHEDULER] Hourly reconciliation error:', error.message);
    }
  });
  
  console.log('[SCHEDULER] Hourly Printful reconciliation cron job initialized');

  // Daily prize expiry: any unclaimed prize past expiresAt flips to 'expired'.
  // Runs at 03:00 server time so it doesn't collide with the Sunday-night
  // winner job. The product itself stays around (history) but is unclaimable.
  cron.schedule('0 3 * * *', async () => {
    console.log('[SCHEDULER] Running daily prize expiry...');
    try {
      const expiredCount = await storage.expireStalePrizes();
      console.log(`[SCHEDULER] Prize expiry complete: ${expiredCount} prize(s) expired`);
    } catch (error: any) {
      console.error('[SCHEDULER] Prize expiry error:', error.message);
    }
  });

  console.log('[SCHEDULER] Daily prize expiry cron job initialized (03:00)');

  // Auto-heal: Check if most recent weekly winner has products, create if missing
  setTimeout(() => {
    autoHealWeeklyWinnerProducts();
  }, 5000); // Wait 5 seconds after startup to ensure DB is ready
  
  // Auto-reconcile on startup: Sync Printful products with database to fix missing sync IDs
  setTimeout(() => {
    reconcilePrintfulProducts();
  }, 10000); // Wait 10 seconds after startup to ensure Printful connection is ready
}
