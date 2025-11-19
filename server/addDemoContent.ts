import { db } from './db';
import { users, quotes, votes, follows } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';

// Sample quotes for each demo account
const sampleQuotes = [
  // Demo 1 - Alex Rivera (inspirational/motivational)
  [
    "The greatest glory in living lies not in never falling, but in rising every time we fall.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "Believe you can and you're halfway there.",
    "The only way to do great work is to love what you do.",
    "Don't watch the clock; do what it does. Keep going.",
    "The future belongs to those who believe in the beauty of their dreams.",
    "It does not matter how slowly you go as long as you do not stop.",
    "Everything you've ever wanted is on the other side of fear.",
  ],
  // Demo 2 - Jordan Chen (philosophical/thoughtful)
  [
    "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    "The unexamined life is not worth living.",
    "In the middle of difficulty lies opportunity.",
    "Life is what happens when you're busy making other plans.",
    "The only true wisdom is in knowing you know nothing.",
    "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.",
    "Not all those who wander are lost.",
    "The mind is everything. What you think you become.",
    "Happiness is not something ready made. It comes from your own actions.",
  ],
  // Demo 3 - Sam Taylor (creative/modern wisdom)
  [
    "Be the change you wish to see in the world.",
    "In three words I can sum up everything I've learned about life: it goes on.",
    "Life is either a daring adventure or nothing at all.",
    "The best time to plant a tree was 20 years ago. The second best time is now.",
    "You miss 100% of the shots you don't take.",
    "The only impossible journey is the one you never begin.",
    "Dream big and dare to fail.",
    "Your time is limited, don't waste it living someone else's life.",
    "Shoutout to @alexrivera for the inspiration today!",
  ],
];

async function addDemoContent() {
  console.log('Adding demo content to existing accounts...\n');

  // Find the demo accounts by email
  const demoEmails = ['demo1@quote-it.co', 'demo2@quote-it.co', 'demo3@quote-it.co'];
  const demoUsers = [];

  for (const email of demoEmails) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    
    if (!user) {
      console.error(`❌ User not found: ${email}`);
      console.log(`   Please create this account first via the signup page`);
      return;
    }
    
    demoUsers.push(user);
    console.log(`✓ Found user: ${user.username} (${email})`);
  }

  console.log('\n');

  // Update demo1 to have a posting streak
  await db.update(users)
    .set({
      currentStreak: 5,
      longestStreak: 7,
      lastPostDate: new Date(),
    })
    .where(eq(users.id, demoUsers[0].id));
  console.log('✓ Updated posting streak for demo1\n');

  // Step 1: Create quotes
  console.log('Creating sample quotes...');
  const createdQuotes: string[] = [];
  
  for (let i = 0; i < demoUsers.length; i++) {
    const user = demoUsers[i];
    const userQuotes = sampleQuotes[i];
    
    for (let j = 0; j < userQuotes.length; j++) {
      // Spread quotes over the past week
      const daysAgo = Math.floor(Math.random() * 7);
      const hoursAgo = Math.floor(Math.random() * 24);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(createdAt.getHours() - hoursAgo);

      const [quote] = await db.insert(quotes).values({
        authorId: user.id,
        text: userQuotes[j],
        createdAt,
      }).returning();

      createdQuotes.push(quote.id);
      console.log(`  ✓ ${user.username}: "${userQuotes[j].substring(0, 50)}..."`);
    }
  }

  console.log(`\n✓ Created ${createdQuotes.length} quotes\n`);

  // Step 2: Create votes
  console.log('Creating votes...');
  let voteCount = 0;
  
  for (const quoteId of createdQuotes) {
    // Get random number of voters (1-3)
    const numVoters = Math.floor(Math.random() * 3) + 1;
    const voters = [...demoUsers].sort(() => 0.5 - Math.random()).slice(0, numVoters);
    
    for (const voter of voters) {
      // Don't let users vote on their own quotes
      const quote = await db.query.quotes.findFirst({
        where: eq(quotes.id, quoteId),
      });
      
      if (quote && quote.authorId !== voter.id) {
        try {
          await db.insert(votes).values({
            userId: voter.id,
            quoteId: quoteId,
            value: 1, // 1 for upvote
          });
          voteCount++;
        } catch (error) {
          // Ignore duplicate vote errors
        }
      }
    }
  }

  console.log(`✓ Created ${voteCount} votes\n`);

  // Step 3: Create follows
  console.log('Creating follow relationships...');
  
  try {
    // Demo1 follows Demo2 and Demo3
    await db.insert(follows).values({
      followerId: demoUsers[0].id,
      followingId: demoUsers[1].id,
    }).onConflictDoNothing();
    
    await db.insert(follows).values({
      followerId: demoUsers[0].id,
      followingId: demoUsers[2].id,
    }).onConflictDoNothing();

    // Demo2 follows Demo1 and Demo3
    await db.insert(follows).values({
      followerId: demoUsers[1].id,
      followingId: demoUsers[0].id,
    }).onConflictDoNothing();

    await db.insert(follows).values({
      followerId: demoUsers[1].id,
      followingId: demoUsers[2].id,
    }).onConflictDoNothing();

    // Demo3 follows Demo1
    await db.insert(follows).values({
      followerId: demoUsers[2].id,
      followingId: demoUsers[0].id,
    }).onConflictDoNothing();

    console.log('✓ Created follow relationships\n');
  } catch (error) {
    console.log('⚠️  Some follow relationships may already exist\n');
  }

  // Summary
  console.log('════════════════════════════════════════════════════════');
  console.log('✓ Demo content added successfully!');
  console.log('════════════════════════════════════════════════════════');
  console.log('\nDemo Accounts:');
  console.log('─────────────────────────────────────────────────────────');
  for (const user of demoUsers) {
    console.log(`Username: @${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.firstName} ${user.lastName}`);
    console.log('─────────────────────────────────────────────────────────');
  }
  console.log('\nFeatures demonstrated:');
  console.log(`• ${createdQuotes.length} quotes posted`);
  console.log(`• ${voteCount} votes cast`);
  console.log('• Follow relationships established');
  console.log('• @mention in one quote');
  console.log('• 5-day posting streak for demo1');
  console.log('• Personalized feed ready to test');
  console.log('════════════════════════════════════════════════════════\n');
}

// Run the content addition
addDemoContent()
  .then(() => {
    console.log('✓ Demo content setup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Error adding demo content:', error);
    process.exit(1);
  });
