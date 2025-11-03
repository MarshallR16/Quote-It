import axios from 'axios';

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
   * Create a sync product with variants in Printful
   */
  async createProduct(quoteText: string, author: string, externalId: string): Promise<PrintfulProduct> {
    try {
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
          { variant_id: 4011, retail_price: '29.99', external_id: `${externalId}-S` },
          { variant_id: 4012, retail_price: '29.99', external_id: `${externalId}-M` },
          { variant_id: 4013, retail_price: '29.99', external_id: `${externalId}-L` },
          { variant_id: 4014, retail_price: '29.99', external_id: `${externalId}-XL` },
          { variant_id: 4017, retail_price: '29.99', external_id: `${externalId}-2XL` },
        ],
      };

      const response = await printfulClient.post('/store/products', data);
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
