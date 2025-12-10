import axios from 'axios';
import QRCode from 'qrcode';
import FormData from 'form-data';
import admin from 'firebase-admin';
import './firebaseAuth'; // Ensure Firebase is initialized

const PRINTFUL_API_URL = 'https://api.printful.com';
const API_TOKEN = process.env.PRINTFUL_API_TOKEN;

const printfulClient = axios.create({
  baseURL: PRINTFUL_API_URL,
  headers: {
    'Authorization': `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

export interface PrintfulProduct {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
}

export interface PrintfulVariant {
  id: number;
  external_id: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  retail_price: string;
  sku: string;
  files: Array<{
    id: number;
    type: string;
    hash: string;
    url: string;
    filename: string;
  }>;
}

export interface PrintfulOrder {
  id: number;
  external_id: string;
  status: string;
  shipping: string;
  created: number;
  updated: number;
}

export class PrintfulService {
  /**
   * Test Printful API connection and return store info
   */
  async testConnection(): Promise<{ success: boolean; message: string; storeInfo?: any; error?: string }> {
    try {
      if (!API_TOKEN) {
        return { 
          success: false, 
          message: 'PRINTFUL_API_TOKEN is not configured',
          error: 'Missing API token'
        };
      }

      console.log('[PRINTFUL] Testing API connection...');
      
      // Test connection by getting store info
      const storeResponse = await printfulClient.get('/stores');
      const stores = storeResponse.data.result;
      
      if (!stores || stores.length === 0) {
        return {
          success: false,
          message: 'No stores found. Please connect a store in your Printful dashboard.',
          error: 'No stores connected'
        };
      }

      // Get the first store's details
      const store = stores[0];
      console.log('[PRINTFUL] Connected to store:', store.name);

      // Also test that we can list products
      const productsResponse = await printfulClient.get('/store/products');
      const productCount = productsResponse.data.result?.length || 0;

      return {
        success: true,
        message: `Successfully connected to Printful store "${store.name}"`,
        storeInfo: {
          id: store.id,
          name: store.name,
          type: store.type,
          productCount
        }
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      const statusCode = error.response?.status;
      
      console.error('[PRINTFUL] Connection test failed:', {
        status: statusCode,
        error: errorMessage,
        fullError: error.response?.data
      });

      let userMessage = 'Failed to connect to Printful';
      if (statusCode === 401) {
        userMessage = 'Invalid API token. Please check your PRINTFUL_API_TOKEN in secrets.';
      } else if (statusCode === 403) {
        userMessage = 'Access forbidden. Your API token may not have the required permissions.';
      } else if (statusCode === 404) {
        userMessage = 'No store found. Please ensure you have a store connected in Printful.';
      }

      return {
        success: false,
        message: userMessage,
        error: errorMessage
      };
    }
  }

  /**
   * Generate QR code data URL
   */
  private async generateQRCode(url: string): Promise<string> {
    try {
      return await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('QR code generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Word-wrap text to fit within a maximum width
   */
  private wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > maxCharsPerLine && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Estimate text width in pixels (rough approximation for Georgia font)
   * Using average character width at given font size
   * Conservative estimate to prevent overlap with wide characters (W, M, etc.)
   */
  private estimateTextWidth(text: string, fontSize: number): number {
    // Georgia serif font: use conservative 0.65 ratio to account for wide glyphs
    // Better to overestimate and drop QR below than risk overlap
    const avgCharWidth = fontSize * 0.65;
    return text.length * avgCharWidth;
  }

  /**
   * Generate simple SVG design with quote, author, and QR code
   */
  /**
   * Public method to generate SVG design (for serving via API endpoint)
   */
  async generateDesignSVGPublic(quoteText: string, author: string, textColor: 'white' | 'gold' = 'white'): Promise<string> {
    return this.generateDesignSVG(quoteText, author, textColor);
  }

  private async generateDesignSVG(quoteText: string, author: string, textColor: 'white' | 'gold' = 'white'): Promise<string> {
    // Use custom domain for QR code on all shirts
    const appUrl = 'https://quote-it.co';

    const qrCodeDataUrl = await this.generateQRCode(appUrl);

    // Wrap quote text to fit nicely on the shirt (40 chars per line)
    const wrappedLines = this.wrapText(quoteText, 40);
    
    // Set text colors based on version
    const quoteColor = textColor === 'gold' ? '#FFD700' : '#FFFFFF';
    const authorColor = textColor === 'gold' ? '#DAA520' : '#CCCCCC';
    
    // Canvas dimensions: 4500x5400px (Printful recommended for 18"x24" print area)
    const canvasHeight = 5400;
    const canvasCenterX = 2250;
    
    // Text and layout settings
    const quoteFontSize = 180;
    const lineSpacing = 220;
    const authorFontSize = 120;
    const qrSize = 400;
    const gapBetweenQuoteAndAuthor = 300;
    const gapBetweenAuthorAndQR = 150;
    
    // Calculate heights for vertical centering
    const quoteBlockHeight = quoteFontSize + (wrappedLines.length - 1) * lineSpacing;
    
    // Total content height (always put QR below author for consistency and simplicity)
    const totalContentHeight = quoteBlockHeight + gapBetweenQuoteAndAuthor + authorFontSize + gapBetweenAuthorAndQR + qrSize;
    
    // Position design in upper-middle area of the shirt (42% down for good T-shirt placement)
    const designCenterY = canvasHeight * 0.42;
    const calculatedQuoteStartY = designCenterY - (totalContentHeight / 2) + quoteFontSize;
    
    // Ensure minimum top margin
    const minTopMargin = 600;
    const quoteStartY = Math.max(minTopMargin + quoteFontSize, calculatedQuoteStartY);
    
    // Generate tspan elements for each line with quotes only at start/end
    const quoteTspans = wrappedLines.map((line, index) => {
      const isFirst = index === 0;
      const isLast = index === wrappedLines.length - 1;
      const openQuote = isFirst ? '\u201C' : ''; // Opening curly quote
      const closeQuote = isLast ? '\u201D' : ''; // Closing curly quote
      return `<tspan x="${canvasCenterX}" dy="${isFirst ? '0' : lineSpacing}">${openQuote}${this.escapeXml(line)}${closeQuote}</tspan>`;
    }).join('\n    ');

    // Position author below the last line of the quote
    // Text Y coordinate is the baseline, so we add authorFontSize to position below the quote baseline
    const lastQuoteLineY = quoteStartY + (wrappedLines.length - 1) * lineSpacing;
    const authorY = lastQuoteLineY + gapBetweenQuoteAndAuthor + authorFontSize;
    
    // Position QR code centered below the author
    // Since author text uses baseline positioning, the text renders above authorY
    // QR y coordinate is top-left corner, so we position it below the author baseline
    const qrX = canvasCenterX - (qrSize / 2);
    const qrY = authorY + gapBetweenAuthorAndQR;

    // Author text with em dash
    const authorWithDash = `\u2014${this.escapeXml(author)}`;

    // Create SVG with quote text, author, and QR code
    // Background is transparent - will print on black shirt
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="4500" height="5400" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <!-- Transparent background (will be black shirt) -->
  <rect width="4500" height="5400" fill="none"/>
  
  <!-- Quote text (centered, large, wrapped, serif font) -->
  <text x="${canvasCenterX}" y="${quoteStartY}" font-family="Georgia, 'Times New Roman', serif" font-size="${quoteFontSize}" font-weight="normal" text-anchor="middle" fill="${quoteColor}">
    ${quoteTspans}
  </text>
  
  <!-- Author name with em dash (centered) -->
  <text x="${canvasCenterX}" y="${authorY}" font-family="Georgia, 'Times New Roman', serif" font-size="${authorFontSize}" text-anchor="middle" fill="${authorColor}">
    ${authorWithDash}
  </text>
  
  <!-- QR Code (centered below author) -->
  <image x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" xlink:href="${qrCodeDataUrl}"/>
</svg>`;

    return svg;
  }

  /**
   * Sanitize text for safe SVG embedding
   * SECURITY: Prevents XSS and SVG injection attacks
   */
  private sanitizeForSVG(text: string): string {
    // First, limit length to prevent DoS
    const maxLength = 500;
    let sanitized = text.substring(0, maxLength);
    
    // Remove control characters and null bytes
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Escape XML special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    // Remove any potential script/event handlers that might slip through
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+=/gi, '');
    
    return sanitized;
  }

  /**
   * Escape XML special characters
   * Uses sanitizeForSVG for comprehensive protection
   */
  private escapeXml(text: string): string {
    return this.sanitizeForSVG(text);
  }

  /**
   * Upload file directly to Printful's file storage
   * Returns the file URL from Printful's CDN
   */
  private async uploadToPrintful(fileContent: string, fileName: string): Promise<string> {
    try {
      console.log('[PRINTFUL] Uploading design file:', fileName);
      
      // Create form data with the file and required type field
      const formData = new FormData();
      formData.append('type', 'default');
      const buffer = Buffer.from(fileContent);
      formData.append('file', buffer, {
        filename: fileName,
        contentType: 'image/svg+xml',
      });

      // Upload to Printful's files endpoint
      const response = await axios.post(`${PRINTFUL_API_URL}/files`, formData, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          ...formData.getHeaders(),
        },
      });

      const fileResult = response.data.result;
      console.log('[PRINTFUL] File uploaded successfully, ID:', fileResult.id);
      
      // Return the file URL from Printful
      return fileResult.url;
    } catch (error: any) {
      console.error('[PRINTFUL] File upload error:', error.response?.data || error.message);
      throw new Error(`Failed to upload to Printful: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Upload SVG design directly to Printful's File Library
   * Returns the file ID that can be used when creating products
   */
  async uploadDesignToFileLibrary(svgContent: string, filename: string): Promise<{ id: number; url: string; thumbnailUrl: string }> {
    try {
      console.log(`[PRINTFUL] Uploading design to File Library: ${filename}`);
      
      // Create form data with the SVG content as a file
      const form = new FormData();
      const svgBuffer = Buffer.from(svgContent, 'utf-8');
      form.append('file', svgBuffer, {
        filename: filename,
        contentType: 'image/svg+xml',
      });
      
      // Upload to Printful's File Library
      const response = await axios.post(`${PRINTFUL_API_URL}/files`, form, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          ...form.getHeaders(),
        },
      });
      
      const result = response.data.result;
      console.log(`[PRINTFUL] Design uploaded successfully. File ID: ${result.id}`);
      console.log(`[PRINTFUL] File URL: ${result.url}`);
      
      return {
        id: result.id,
        url: result.url,
        thumbnailUrl: result.thumbnail_url || result.preview_url || result.url,
      };
    } catch (error: any) {
      console.error('[PRINTFUL] File upload error:', error.response?.data || error.message);
      throw new Error(`Failed to upload design to Printful: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Upload SVG to Firebase Storage and return public URL (fallback)
   */
  private async uploadToFirebaseStorage(fileContent: string, fileName: string): Promise<string> {
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(`printful-designs/${fileName}`);
      
      await file.save(Buffer.from(fileContent), {
        contentType: 'image/svg+xml',
        public: true,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
      return publicUrl;
    } catch (error: any) {
      console.error('Firebase Storage upload error:', error.message);
      throw new Error(`Failed to upload to Firebase Storage: ${error.message}`);
    }
  }

  /**
   * Create a sync product with variants and design file in Printful
   * Now uploads design directly to Printful's File Library for reliability
   */
  async createProduct(quoteText: string, author: string, externalId: string, textColor: 'white' | 'gold' = 'white', quoteId?: string, thumbnailUrl?: string): Promise<PrintfulProduct> {
    try {
      console.log(`[PRINTFUL] Creating product for quote with ${textColor} text:`, quoteText.substring(0, 50) + '...');
      
      // Step 1: Generate the SVG design
      console.log('[PRINTFUL] Generating SVG design...');
      const svgContent = await this.generateDesignSVG(quoteText, author, textColor);
      
      // Step 2: Upload the design directly to Printful's File Library
      const filename = `quote-${quoteId || externalId}-${textColor}.svg`;
      console.log('[PRINTFUL] Uploading design to Printful File Library...');
      const uploadedFile = await this.uploadDesignToFileLibrary(svgContent, filename);
      console.log(`[PRINTFUL] Design uploaded with File ID: ${uploadedFile.id}`);

      // For T-shirts, we'll use Bella+Canvas 3001 (common high-quality unisex tee)
      // Variant IDs from Printful catalog for BLACK color (verified from API):
      // 4016 - S / Black
      // 4017 - M / Black
      // 4018 - L / Black
      // 4019 - XL / Black
      // 4020 - 2XL / Black

      const productName = `"${quoteText.substring(0, 50)}${quoteText.length > 50 ? '...' : ''}"`;
      
      // Build sync_product with thumbnail from the uploaded file
      const syncProduct: any = {
        name: productName,
        external_id: externalId,
        thumbnail: uploadedFile.thumbnailUrl,
      };
      
      // File reference for all variants - using file ID instead of URL
      const fileSpec = { 
        id: uploadedFile.id,
        type: 'front',
        position: {
          area_width: 1800,
          area_height: 2400,
          width: 1800,
          height: 2160,
          top: 120,
          left: 0
        }
      };
      
      const data = {
        sync_product: syncProduct,
        sync_variants: [
          { 
            variant_id: 4016, 
            retail_price: '29.99', 
            external_id: `${externalId}-S`,
            files: [fileSpec]
          },
          { 
            variant_id: 4017, 
            retail_price: '29.99', 
            external_id: `${externalId}-M`,
            files: [fileSpec]
          },
          { 
            variant_id: 4018, 
            retail_price: '29.99', 
            external_id: `${externalId}-L`,
            files: [fileSpec]
          },
          { 
            variant_id: 4019, 
            retail_price: '29.99', 
            external_id: `${externalId}-XL`,
            files: [fileSpec]
          },
          { 
            variant_id: 4020, 
            retail_price: '29.99', 
            external_id: `${externalId}-2XL`,
            files: [fileSpec]
          },
        ],
      };

      console.log('[PRINTFUL] Creating product with File ID:', uploadedFile.id);
      console.log('[PRINTFUL] Variant IDs being sent:', data.sync_variants.map((v: any) => v.variant_id));
      const response = await printfulClient.post('/store/products', data);
      console.log('[PRINTFUL] Product created successfully:', response.data.result.id);
      
      return response.data.result;
    } catch (error: any) {
      console.error('Printful create product error:', error.response?.data || error.message);
      throw new Error(`Failed to create Printful product: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get product details from Printful
   */
  async getProduct(syncProductId: number): Promise<PrintfulProduct> {
    try {
      const response = await printfulClient.get(`/store/products/${syncProductId}`);
      return response.data.result.sync_product;
    } catch (error: any) {
      console.error('Printful get product error:', error.response?.data || error.message);
      throw new Error(`Failed to get Printful product: ${error.message}`);
    }
  }

  /**
   * List all products in the Printful store
   */
  async listProducts(): Promise<any[]> {
    try {
      const response = await printfulClient.get('/store/products');
      return response.data.result || [];
    } catch (error: any) {
      console.error('Printful list products error:', error.response?.data || error.message);
      throw new Error(`Failed to list Printful products: ${error.message}`);
    }
  }

  /**
   * Get detailed product info including variants and files
   */
  async getProductDetails(syncProductId: number): Promise<any> {
    try {
      const response = await printfulClient.get(`/store/products/${syncProductId}`);
      return response.data.result;
    } catch (error: any) {
      console.error('Printful get product details error:', error.response?.data || error.message);
      throw new Error(`Failed to get Printful product details: ${error.message}`);
    }
  }

  /**
   * Create a mockup for a product variant
   */
  async createMockup(variantId: number, imageUrl: string): Promise<string> {
    try {
      const data = {
        variant_ids: [variantId],
        format: 'jpg',
        files: [
          {
            placement: 'front',
            image_url: imageUrl,
          },
        ],
      };

      const response = await printfulClient.post(`/mockup-generator/create-task/${variantId}`, data);
      const taskKey = response.data.result.task_key;

      // Poll for mockup completion (max 30 seconds)
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await printfulClient.get(`/mockup-generator/task?task_key=${taskKey}`);
        const task = statusResponse.data.result;
        
        if (task.status === 'completed') {
          return task.mockups[0]?.mockup_url || '';
        } else if (task.status === 'failed') {
          throw new Error('Mockup generation failed');
        }
      }

      throw new Error('Mockup generation timed out');
    } catch (error: any) {
      console.error('Printful mockup error:', error.response?.data || error.message);
      throw new Error(`Failed to create mockup: ${error.message}`);
    }
  }

  /**
   * Create an order in Printful
   */
  async createOrder(
    externalId: string,
    recipient: {
      name: string;
      address1: string;
      city: string;
      state_code: string;
      country_code: string;
      zip: string;
      email: string;
    },
    items: Array<{
      sync_variant_id: number;
      quantity: number;
    }>
  ): Promise<PrintfulOrder> {
    try {
      const data = {
        external_id: externalId,
        recipient,
        items,
      };

      const response = await printfulClient.post('/orders', data);
      return response.data.result;
    } catch (error: any) {
      console.error('Printful create order error:', error.response?.data || error.message);
      throw new Error(`Failed to create Printful order: ${error.message}`);
    }
  }

  /**
   * Confirm an order (submit for fulfillment)
   */
  async confirmOrder(orderId: number): Promise<PrintfulOrder> {
    try {
      const response = await printfulClient.post(`/orders/${orderId}/confirm`);
      return response.data.result;
    } catch (error: any) {
      console.error('Printful confirm order error:', error.response?.data || error.message);
      throw new Error(`Failed to confirm Printful order: ${error.message}`);
    }
  }

  /**
   * Get product variants from Printful catalog to verify correct variant IDs
   * Product ID 71 = Bella+Canvas 3001 Unisex T-Shirt
   */
  async getCatalogVariants(productId: number = 71): Promise<any> {
    try {
      console.log(`[PRINTFUL] Fetching catalog variants for product ${productId}...`);
      const response = await printfulClient.get(`/products/${productId}`);
      const product = response.data.result.product;
      const variants = response.data.result.variants;
      
      // Filter for black variants
      const blackVariants = variants.filter((v: any) => 
        v.color?.toLowerCase() === 'black' || 
        v.color_code === '#000000' ||
        v.name?.toLowerCase().includes('black')
      );
      
      console.log(`[PRINTFUL] Found ${blackVariants.length} black variants for ${product.title}`);
      
      return {
        product: {
          id: product.id,
          title: product.title,
          type: product.type,
        },
        blackVariants: blackVariants.map((v: any) => ({
          variant_id: v.id,
          size: v.size,
          color: v.color,
          color_code: v.color_code,
          name: v.name,
          price: v.price,
        })),
        allVariantsCount: variants.length,
      };
    } catch (error: any) {
      console.error('[PRINTFUL] Error fetching catalog variants:', error.response?.data || error.message);
      throw new Error(`Failed to fetch catalog variants: ${error.message}`);
    }
  }

  /**
   * Get existing store products to see their variants
   */
  async getStoreProducts(): Promise<any> {
    try {
      console.log('[PRINTFUL] Fetching store products...');
      const response = await printfulClient.get('/store/products');
      const products = response.data.result;
      
      // Get detailed info for each product including variants
      const detailedProducts = [];
      for (const product of products.slice(0, 5)) { // Limit to 5 most recent
        try {
          const detailResponse = await printfulClient.get(`/store/products/${product.id}`);
          const syncProduct = detailResponse.data.result.sync_product;
          const syncVariants = detailResponse.data.result.sync_variants;
          
          detailedProducts.push({
            id: syncProduct.id,
            name: syncProduct.name,
            variants: syncVariants.map((v: any) => ({
              variant_id: v.variant_id,
              name: v.name,
              color: v.color,
              size: v.size,
              retail_price: v.retail_price,
            })),
          });
        } catch (e) {
          // Skip if can't get details
        }
      }
      
      return {
        totalProducts: products.length,
        products: detailedProducts,
      };
    } catch (error: any) {
      console.error('[PRINTFUL] Error fetching store products:', error.response?.data || error.message);
      throw new Error(`Failed to fetch store products: ${error.message}`);
    }
  }
}

export const printfulService = new PrintfulService();
