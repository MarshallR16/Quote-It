import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { db } from './db';
import { users, quotes, votes, follows } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';

const DEMO_PASSWORD = 'Demo2025!';

const demoAccounts = [
  {
    email: 'demo1@quote-it.co',
    firstName: 'Alex',
    lastName: 'Rivera',
  },
  {
    email: 'demo2@quote-it.co',
    firstName: 'Jordan',
    lastName: 'Chen',
  },
  {
    email: 'demo3@quote-it.co',
    firstName: 'Sam',
    lastName: 'Taylor',
  },
];

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

async function setupDemoAccounts() {
  console.log('Setting up demo accounts for Apple reviewers...\n');

  // Initialize Firebase Admin if not already initialized
  if (getApps().length === 0) {
    const serviceAccount = {
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: `firebase-adminsdk@${process.env.VITE_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount as any),
    });
  }

  const auth = getAuth();
  const createdUsers: Array<{ firebaseUid: string; email: string; username: string }> = [];

  // Step 1: Create Firebase accounts and database users
  console.log('Step 1: Creating Firebase accounts and database users...');
  for (let i = 0; i < demoAccounts.length; i++) {
    const account = demoAccounts[i];
    try {
      // Try to get existing user first
      let firebaseUser;
      try {
        firebaseUser = await auth.getUserByEmail(account.email);
        console.log(`  ✓ Firebase user already exists: ${account.email}`);
        
        // Update password
        await auth.updateUser(firebaseUser.uid, { password: DEMO_PASSWORD });
        console.log(`  ✓ Updated password for: ${account.email}`);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // Create new Firebase user
          firebaseUser = await auth.createUser({
            email: account.email,
            password: DEMO_PASSWORD,
            displayName: `${account.firstName} ${account.lastName}`,
            emailVerified: true,
          });
          console.log(`  ✓ Created Firebase user: ${account.email}`);
        } else {
          throw error;
        }
      }

      // Generate username
      const username = `${account.firstName.toLowerCase()}${account.lastName.toLowerCase()}`;
      
      // Generate unique referral code
      const referralCode = `DEMO${i + 1}REF`;

      // Check if database user exists
      const existingDbUser = await db.query.users.findFirst({
        where: eq(users.id, firebaseUser.uid),
      });

      if (existingDbUser) {
        console.log(`  ✓ Database user already exists: ${username}`);
        createdUsers.push({
          firebaseUid: firebaseUser.uid,
          email: account.email,
          username: existingDbUser.username,
        });
      } else {
        // Create database user
        const [dbUser] = await db.insert(users).values({
          id: firebaseUser.uid,
          email: account.email,
          username,
          firstName: account.firstName,
          lastName: account.lastName,
          profileImageUrl: null,
          referralCode,
          isAdmin: false,
          currentStreak: i === 0 ? 5 : 0, // Give demo1 a 5-day streak
          longestStreak: i === 0 ? 7 : 0,
          lastPostDate: i === 0 ? new Date() : null,
        }).returning();

        console.log(`  ✓ Created database user: ${username}`);
        createdUsers.push({
          firebaseUid: firebaseUser.uid,
          email: account.email,
          username: dbUser.username,
        });
      }
    } catch (error) {
      console.error(`  ✗ Error creating account ${account.email}:`, error);
    }
  }

  console.log(`\n✓ Created ${createdUsers.length} accounts\n`);

  // Step 2: Create quotes
  console.log('Step 2: Creating sample quotes...');
  const createdQuotes: string[] = [];
  
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    const userQuotes = sampleQuotes[i];
    
    for (let j = 0; j < userQuotes.length; j++) {
      const daysAgo = Math.floor(Math.random() * 7); // Random day in past week
      const hoursAgo = Math.floor(Math.random() * 24);
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      createdAt.setHours(createdAt.getHours() - hoursAgo);

      const [quote] = await db.insert(quotes).values({
        authorId: user.firebaseUid,
        text: userQuotes[j],
        createdAt,
      }).returning();

      createdQuotes.push(quote.id);
      console.log(`  ✓ Created quote by ${user.username}: "${userQuotes[j].substring(0, 50)}..."`);
    }
  }

  console.log(`\n✓ Created ${createdQuotes.length} quotes\n`);

  // Step 3: Create votes
  console.log('Step 3: Creating votes...');
  let voteCount = 0;
  
  for (const quoteId of createdQuotes) {
    // Get random number of voters (1-3)
    const numVoters = Math.floor(Math.random() * 3) + 1;
    const voters = [...createdUsers].sort(() => 0.5 - Math.random()).slice(0, numVoters);
    
    for (const voter of voters) {
      // Don't let users vote on their own quotes
      const quote = await db.query.quotes.findFirst({
        where: eq(quotes.id, quoteId as string),
      });
      
      if (quote && quote.authorId !== voter.firebaseUid) {
        try {
          await db.insert(votes).values({
            userId: voter.firebaseUid,
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

  // Step 4: Create follows
  console.log('Step 4: Creating follow relationships...');
  
  // Demo1 follows Demo2 and Demo3
  await db.insert(follows).values({
    followerId: createdUsers[0].firebaseUid,
    followingId: createdUsers[1].firebaseUid,
  }).onConflictDoNothing();
  
  await db.insert(follows).values({
    followerId: createdUsers[0].firebaseUid,
    followingId: createdUsers[2].firebaseUid,
  }).onConflictDoNothing();

  // Demo2 follows Demo1 and Demo3
  await db.insert(follows).values({
    followerId: createdUsers[1].firebaseUid,
    followingId: createdUsers[0].firebaseUid,
  }).onConflictDoNothing();

  await db.insert(follows).values({
    followerId: createdUsers[1].firebaseUid,
    followingId: createdUsers[2].firebaseUid,
  }).onConflictDoNothing();

  // Demo3 follows Demo1
  await db.insert(follows).values({
    followerId: createdUsers[2].firebaseUid,
    followingId: createdUsers[0].firebaseUid,
  }).onConflictDoNothing();

  console.log('✓ Created follow relationships\n');

  // Summary
  console.log('════════════════════════════════════════════════════════');
  console.log('Demo accounts setup complete!');
  console.log('════════════════════════════════════════════════════════');
  console.log('\nLogin Credentials:');
  console.log('─────────────────────────────────────────────────────────');
  for (const user of createdUsers) {
    console.log(`Email: ${user.email}`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log(`Username: @${user.username}`);
    console.log('─────────────────────────────────────────────────────────');
  }
  console.log('\nFeatures demonstrated:');
  console.log('• Quote posting and viewing');
  console.log('• Upvoting system');
  console.log('• Follow relationships');
  console.log('• @mention functionality');
  console.log('• Posting streaks (demo1 has a 5-day streak)');
  console.log('• Personalized feed algorithm');
  console.log('════════════════════════════════════════════════════════\n');
}

// Run the setup
setupDemoAccounts()
  .then(() => {
    console.log('✓ Demo setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Error setting up demo accounts:', error);
    process.exit(1);
  });
