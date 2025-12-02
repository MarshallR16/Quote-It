import axios from 'axios';

const PRINTFUL_API_URL = 'https://api.printful.com';
const API_TOKEN = process.env.PRINTFUL_API_TOKEN;

async function deleteTestProducts() {
  try {
    console.log('--- Deleting Test Products from Printful ---\n');
    
    // First, get all products
    console.log('1. Fetching products from Printful...');
    const response = await axios.get(`${PRINTFUL_API_URL}/store/products`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });
    
    const products = response.data.result;
    console.log(`Found ${products.length} products:\n`);
    
    for (const product of products) {
      console.log(`  - ID: ${product.id}, Name: "${product.name}", External ID: ${product.external_id}`);
    }
    
    // Delete each product
    console.log('\n2. Deleting products...');
    for (const product of products) {
      try {
        await axios.delete(`${PRINTFUL_API_URL}/store/products/${product.id}`, {
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
          },
        });
        console.log(`   ✓ Deleted: "${product.name}" (ID: ${product.id})`);
      } catch (err) {
        console.error(`   ✗ Failed to delete: "${product.name}" - ${err.message}`);
      }
    }
    
    // Verify deletion
    console.log('\n3. Verifying deletion...');
    const verifyResponse = await axios.get(`${PRINTFUL_API_URL}/store/products`, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
      },
    });
    console.log(`Products remaining: ${verifyResponse.data.result.length}`);
    
    console.log('\n✓ Done!');
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

deleteTestProducts();
