import '../firebaseAuth';
import { selectWeeklyWinner } from '../scheduler';

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    console.error('This script can only run in development');
    process.exit(1);
  }

  console.log('Testing weekly winner selection...');
  
  try {
    const result = await selectWeeklyWinner();
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

main();
