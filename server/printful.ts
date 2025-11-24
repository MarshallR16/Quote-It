import axios from 'axios';
import QRCode from 'qrcode';

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
   * Generate simple SVG design with quote, author, and QR code
   */
  private async generateDesignSVG(quoteText: string, author: string, textColor: 'white' | 'gold' = 'white'): Promise<string> {
    // Use custom domain for QR code on all shirts
    const appUrl = 'https://quote-it.co';

    const qrCodeDataUrl = await this.generateQRCode(appUrl);

    // Wrap quote text to fit nicely on the shirt (40 chars per line)
    const wrappedLines = this.wrapText(quoteText, 40);
    
    // Set text colors based on version
    const quoteColor = textColor === 'gold' ? '#FFD700' : '#FFFFFF';
    const authorColor = textColor === 'gold' ? '#DAA520' : '#CCCCCC';
    
    // Generate tspan elements for each line with quotes only at start/end
    const quoteTspans = wrappedLines.map((line, index) => {
      const isFirst = index === 0;
      const isLast = index === wrappedLines.length - 1;
      const openQuote = isFirst ? '\u201C' : ''; // Opening curly quote
      const closeQuote = isLast ? '\u201D' : ''; // Closing curly quote
      return `<tspan x="2250" dy="${isFirst ? '0' : '220'}">${openQuote}${this.escapeXml(line)}${closeQuote}</tspan>`;
    }).join('\n    ');

    // Adjust author position based on number of quote lines
    const authorY = 2000 + (wrappedLines.length * 220) + 400;

    // Create SVG with quote text, author, and QR code
    // Dimensions: 4500x5400px (Printful recommended for 18"x24" print area)
    // Background is transparent - will print on black shirt
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="4500" height="5400" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <!-- Transparent background (will be black shirt) -->
  <rect width="4500" height="5400" fill="none"/>
  
  <!-- Quote text (centered, large, wrapped, serif font) -->
  <text x="2250" y="2000" font-family="Georgia, 'Times New Roman', serif" font-size="180" font-weight="normal" text-anchor="middle" fill="${quoteColor}">
    ${quoteTspans}
  </text>
  
  <!-- Author name with em dash -->
  <text x="1750" y="${authorY}" font-family="Georgia, 'Times New Roman', serif" font-size="120" text-anchor="start" fill="${authorColor}">
    \u2014${this.escapeXml(author)}
  </text>
  
  <!-- QR Code (to the right of author name) -->
  <image x="2700" y="${authorY - 80}" width="400" height="400" xlink:href="${qrCodeDataUrl}"/>
</svg>`;

    return svg;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Upload file to Printful
   */
  private async uploadFile(fileContent: string, fileName: string): Promise<{ id: number; url: string }> {
    try {
      // Convert SVG to base64
      const base64Content = Buffer.from(fileContent).toString('base64');
      
      const data = {
        type: 'default',
        url: `data:image/svg+xml;base64,${base64Content}`,
        filename: fileName,
      };

      const response = await printfulClient.post('/files', data);
      return {
        id: response.data.result.id,
        url: response.data.result.url,
      };
    } catch (error: any) {
      console.error('Printful file upload error:', error.response?.data || error.message);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Create a sync product with variants and design file in Printful
   */
  async createProduct(quoteText: string, author: string, externalId: string, textColor: 'white' | 'gold' = 'white'): Promise<PrintfulProduct> {
    try {
      console.log(`Generating design for quote with ${textColor} text:`, quoteText);
      
      // Generate design SVG with specified text color
      const designSVG = await this.generateDesignSVG(quoteText, author, textColor);
      
      // Upload design to Printful
      console.log('Uploading design to Printful...');
      const uploadedFile = await this.uploadFile(designSVG, `${externalId}-${textColor}-design.svg`);
      console.log('Design uploaded successfully:', uploadedFile.id);

      // For T-shirts, we'll use Bella+Canvas 3001 (common high-quality unisex tee)
      // Variant IDs from Printful catalog:
      // 4011 - S / Black
      // 4012 - M / Black
      // 4013 - L / Black
      // 4014 - XL / Black
      // 4017 - 2XL / Black

      const productName = `"${quoteText.substring(0, 50)}${quoteText.length > 50 ? '...' : ''}"`;
      
      const data = {
        sync_product: {
          name: productName,
          external_id: externalId,
        },
        sync_variants: [
          { 
            variant_id: 4011, 
            retail_price: '29.99', 
            external_id: `${externalId}-S`,
            files: [{ id: uploadedFile.id }]
          },
          { 
            variant_id: 4012, 
            retail_price: '29.99', 
            external_id: `${externalId}-M`,
            files: [{ id: uploadedFile.id }]
          },
          { 
            variant_id: 4013, 
            retail_price: '29.99', 
            external_id: `${externalId}-L`,
            files: [{ id: uploadedFile.id }]
          },
          { 
            variant_id: 4014, 
            retail_price: '29.99', 
            external_id: `${externalId}-XL`,
            files: [{ id: uploadedFile.id }]
          },
          { 
            variant_id: 4017, 
            retail_price: '29.99', 
            external_id: `${externalId}-2XL`,
            files: [{ id: uploadedFile.id }]
          },
        ],
      };

      console.log('Creating Printful product...');
      const response = await printfulClient.post('/store/products', data);
      console.log('Printful product created successfully:', response.data.result.id);
      
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
}

export const printfulService = new PrintfulService();
