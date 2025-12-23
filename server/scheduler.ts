import cron from 'node-cron';
import { storage } from './storage';
import { PrintfulService } from './printful';

const isPrintfulConfigured = !!process.env.PRINTFUL_API_TOKEN;
const printfulService = isPrintfulConfigured ? new PrintfulService() : null;

// Design base URL for Printful - defaults to production domain
// Printful must be able to access designs externally, so this should be a publicly accessible URL
const DESIGN_BASE_URL = process.env.DESIGN_BASE_URL || 'https://quote-it.co';

/**
 * Reconcile Printful products with database - fixes missing sync IDs
 * This runs on startup and can be called manually to ensure data consistency
 */
export async function reconcilePrintfulProducts(): Promise<{ fixed: number; errors: string[] }> {
  const result = { fixed: 0, errors: [] as string[] };
  
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
    
    // Build a map of database products by quote_id for quick lookup
    const dbProductsByQuoteId = new Map<string, typeof dbProducts>();
    for (const product of dbProducts) {
      const existing = dbProductsByQuoteId.get(product.quoteId) || [];
      existing.push(product);
      dbProductsByQuoteId.set(product.quoteId, existing);
    }
    
    // Check each Printful product
    for (const pfProduct of printfulProducts) {
      const externalId = pfProduct.external_id;
      
      // Parse external_id format: quote-{uuid}-{type}
      // Examples: quote-13cab244-9766-43a7-a4a9-19c895aefecd-gold
      //           quote-13cab244-9766-43a7-a4a9-19c895aefecd-white-author
      //           quote-13cab244-9766-43a7-a4a9-19c895aefecd-white-noauthor
      // NOTE: UUIDs contain dashes, so we can't just split by dash!
      if (!externalId || !externalId.startsWith('quote-')) {
        continue; // Skip non-quote products
      }
      
      // Extract the quote ID (UUID) by finding the type suffix and removing it
      // Type suffixes are: -gold, -white-author, -white-noauthor, -white
      let quoteId: string;
      let isGold = false;
      let isWhiteAuthor = false;
      let isWhiteNoAuthor = false;
      
      const withoutPrefix = externalId.substring(6); // Remove 'quote-'
      
      if (withoutPrefix.endsWith('-gold')) {
        quoteId = withoutPrefix.slice(0, -5); // Remove '-gold'
        isGold = true;
      } else if (withoutPrefix.endsWith('-white-noauthor')) {
        quoteId = withoutPrefix.slice(0, -15); // Remove '-white-noauthor'
        isWhiteNoAuthor = true;
      } else if (withoutPrefix.endsWith('-white-author')) {
        quoteId = withoutPrefix.slice(0, -13); // Remove '-white-author'
        isWhiteAuthor = true;
      } else if (withoutPrefix.endsWith('-white')) {
        quoteId = withoutPrefix.slice(0, -6); // Remove '-white' (legacy format)
        isWhiteAuthor = true;
      } else {
        console.log(`[RECONCILE] Unknown external_id format: ${externalId}`);
        continue;
      }
      
      console.log(`[RECONCILE] Parsed external_id: ${externalId} -> quoteId: ${quoteId}, gold: ${isGold}, whiteAuthor: ${isWhiteAuthor}, whiteNoAuthor: ${isWhiteNoAuthor}`);
      
      // Find matching database products for this quote
      const matchingProducts = dbProductsByQuoteId.get(quoteId) || [];
      
      for (const dbProduct of matchingProducts) {
        // Check if this DB product matches the Printful product type
        const nameLower = dbProduct.name.toLowerCase();
        const isDbGold = nameLower.includes('gold');
        const isDbNoAuthor = nameLower.includes('no author') || nameLower.includes('without') || nameLower.includes('quote only');
        const isDbWithAuthor = nameLower.includes('with attribution') || nameLower.includes('white edition');
        
        let isMatch = false;
        if (isGold && isDbGold) isMatch = true;
        else if (isWhiteNoAuthor && isDbNoAuthor) isMatch = true;
        else if (isWhiteAuthor && (isDbWithAuthor || (!isDbGold && !isDbNoAuthor))) isMatch = true;
        
        if (isMatch && !dbProduct.printfulSyncProductId) {
          // Found a match - update the database with the Printful sync ID
          console.log(`[RECONCILE] Fixing product ${dbProduct.id}: setting printfulSyncProductId to ${pfProduct.id}`);
          try {
            await storage.updateProduct(dbProduct.id, {
              printfulSyncProductId: pfProduct.id,
            });
            result.fixed++;
            console.log(`[RECONCILE] Fixed: ${dbProduct.name} -> Printful ID ${pfProduct.id}`);
          } catch (updateError: any) {
            result.errors.push(`Failed to update ${dbProduct.id}: ${updateError.message}`);
          }
        }
      }
    }
    
    console.log(`[RECONCILE] Reconciliation complete. Fixed ${result.fixed} products.`);
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
      
      // In development, skip Printful because design URLs point to production
      // which may have different database state. Use admin endpoint to sync Printful later.
      const isProduction = process.env.NODE_ENV === 'production';
      
      // Only try Printful in production where design URLs will work
      if (isProduction && isPrintfulConfigured && printfulService) {
        try {
          console.log('[SCHEDULER] Production environment - creating gold product with Printful...');
          const connectionTest = await printfulService.testConnection();
          
          if (connectionTest.success) {
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
      } else if (!isProduction) {
        console.log('[SCHEDULER] Development environment - skipping Printful, creating demo gold product');
        console.log('[SCHEDULER] Use POST /api/admin/sync-gold-product to sync with Printful in production');
      }
      
      // Fallback: create demo gold product if Printful failed or not in production
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
      
      // Auto-sync: If gold product exists but lacks Printful sync, try to sync it now
      // This requires a publicly accessible design URL (works in production, not development)
      if (existingGoldProduct && !existingGoldProduct.printfulSyncProductId && isPrintfulConfigured && printfulService) {
        console.log('[SCHEDULER] Gold product exists but lacks Printful sync - attempting auto-sync...');
        
        // Check if we're in development mode - skip Printful sync entirely
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment) {
          console.log('[SCHEDULER] Skipping Printful sync in development mode.');
          console.log('[SCHEDULER] Reason: Printful requires publicly accessible design URLs (quote-it.co/api/designs/...)');
          console.log('[SCHEDULER] The quote may not exist in the production database, causing 404 errors.');
          console.log('[SCHEDULER] Product will be synced when the app runs in production mode.');
        } else {
          // Only attempt Printful sync in production mode
          try {
            const connectionTest = await printfulService.testConnection();
            if (connectionTest.success) {
              // Try to create product with external URL
              const printfulGoldProduct = await printfulService.createProduct(
                winner.quoteText,
                authorName,
                `quote-${winner.quoteId}-gold`,
                'gold',
                winner.quoteId,
                true // includeAuthor = true
              );
              
              const goldSyncId = (printfulGoldProduct as any)?.sync_product?.id || printfulGoldProduct?.id;
              if (goldSyncId) {
                await storage.updateProduct(existingGoldProduct.id, {
                  printfulSyncProductId: goldSyncId,
                  printfulSyncVariants: printfulGoldProduct,
                });
                console.log(`[SCHEDULER] Auto-synced gold product with Printful ID: ${goldSyncId}`);
              }
            }
          } catch (syncError: any) {
            console.error('[SCHEDULER] Auto-sync failed:', syncError.message);
          }
        }
      }
    }
    
    // Always check for complimentary order - runs even if gold product already existed
    if (goldProductId) {
      const existingOrders = await storage.getOrdersByUser(winner.authorId);
      const existingComplimentaryOrder = existingOrders.find(o => o.isComplimentary && o.productId === goldProductId);
      
      if (!existingComplimentaryOrder) {
        // No order exists - create one
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
      } else if (existingComplimentaryOrder.status === 'failed' || existingComplimentaryOrder.status === 'pending') {
        // Order exists but is in a failed/pending state - reset it so winner can try again
        try {
          await storage.updateOrder(existingComplimentaryOrder.id, { 
            status: 'awaiting_address',
            printfulOrderId: null,  // Clear any failed Printful reference
          });
          console.log('[SCHEDULER] Reset failed complimentary order to awaiting_address:', existingComplimentaryOrder.id);
        } catch (resetError: any) {
          console.error('[SCHEDULER] Error resetting complimentary order:', resetError.message);
        }
      } else {
        // Order is in awaiting_address, completed, or fulfilled - leave it alone
        console.log('[SCHEDULER] Winner already has a complimentary order with status:', existingComplimentaryOrder.status);
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
  
  // Auto-reconcile: Sync Printful products with database to fix missing sync IDs
  setTimeout(() => {
    reconcilePrintfulProducts();
  }, 10000); // Wait 10 seconds after startup to ensure Printful connection is ready
}
