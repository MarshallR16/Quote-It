import { type User, type UpsertUser, type Quote, type QuoteWithAuthor, type InsertQuote, type Vote, type InsertVote, type Product, type InsertProduct, type Order, type InsertOrder, type WeeklyWinner, type InsertWeeklyWinner, type HallOfFame, type InsertHallOfFame, type Follow, type InsertFollow, users, quotes, votes, products, orders, weeklyWinners, hallOfFame, follows } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  updateUserProfileImage(userId: string, profileImageUrl: string): Promise<void>;
  incrementReferralCount(userId: string): Promise<void>;
  incrementUsedReferralDiscounts(userId: string): Promise<void>;
  createQuoteWithLimitCheck(userId: string, quoteData: InsertQuote): Promise<{ success: boolean; quote?: Quote; remaining?: number; error?: string }>;

  // Quote methods
  getQuote(id: string): Promise<Quote | undefined>;
  getAllQuotes(): Promise<QuoteWithAuthor[]>;
  getQuotesByUser(userId: string): Promise<QuoteWithAuthor[]>;
  getPersonalizedQuotes(userId: string): Promise<QuoteWithAuthor[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, data: Partial<Quote>): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;

  // Vote methods
  getVote(quoteId: string, userId: string): Promise<Vote | undefined>;
  createVote(vote: InsertVote): Promise<Vote>;
  updateVote(id: string, value: number): Promise<Vote>;
  deleteVote(id: string): Promise<void>;

  // Product methods
  getProduct(id: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getActiveProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProductStatus(id: string, isActive: boolean): Promise<Product>;

  // Order methods
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<Order>): Promise<Order>;
  updateOrderStatus(id: string, status: string, stripePaymentIntentId?: string): Promise<Order>;

  // Weekly Winner methods
  getWeeklyWinner(id: string): Promise<WeeklyWinner | undefined>;
  getCurrentWeeklyWinner(): Promise<WeeklyWinner | undefined>;
  getMostRecentWeeklyWinnerWithDetails(): Promise<any | undefined>;
  getAllWeeklyWinners(): Promise<WeeklyWinner[]>;
  createWeeklyWinner(winner: InsertWeeklyWinner): Promise<WeeklyWinner>;
  updateWeeklyWinner(id: string, data: Partial<InsertWeeklyWinner>): Promise<WeeklyWinner>;

  // Hall of Fame methods
  getHallOfFame(): Promise<HallOfFame[]>;
  addToHallOfFame(entry: InsertHallOfFame): Promise<HallOfFame>;

  // Follow methods
  getFollow(followerId: string, followingId: string): Promise<Follow | undefined>;
  followUser(followerId: string, followingId: string): Promise<Follow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  getFollowing(userId: string): Promise<(Follow & { following: User })[]>;
  getFollowers(userId: string): Promise<(Follow & { follower: User })[]>;
  getFriends(userId: string): Promise<User[]>;
  getFriendsQuotes(userId: string): Promise<QuoteWithAuthor[]>;
}

export class DbStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] as User | undefined;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.referralCode, referralCode)).limit(1);
    return result[0] as User | undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0] as User;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0] as User;
  }

  async updateUserProfileImage(userId: string, profileImageUrl: string): Promise<void> {
    await db.update(users)
      .set({ profileImageUrl, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async incrementReferralCount(userId: string): Promise<void> {
    await db.update(users)
      .set({ 
        referralCount: sql`${users.referralCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async incrementUsedReferralDiscounts(userId: string): Promise<void> {
    await db.update(users)
      .set({ 
        usedReferralDiscounts: sql`${users.usedReferralDiscounts} + 1`,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async createQuoteWithLimitCheck(userId: string, quoteData: InsertQuote): Promise<{ success: boolean; quote?: Quote; remaining?: number; error?: string }> {
    // Use a transaction to atomically check limit, increment counter, and create quote
    return await db.transaction(async (tx) => {
      // Lock the user row for update
      const user = await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1);
      if (!user[0]) {
        return { success: false, error: "User not found" };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastPostDate = user[0].lastPostDate ? new Date(user[0].lastPostDate) : null;
      const isNewDay = !lastPostDate || lastPostDate.getTime() < today.getTime();
      const currentCount = isNewDay ? 0 : (user[0].dailyPostCount || 0);

      // Check limit
      if (currentCount >= 3) {
        return { success: false, remaining: 0, error: "Daily limit reached" };
      }

      // Calculate streak
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const lastStreakDate = user[0].lastStreakDate ? new Date(user[0].lastStreakDate) : null;
      if (lastStreakDate) {
        lastStreakDate.setHours(0, 0, 0, 0);
      }
      
      let newStreak = user[0].currentStreak || 0;
      
      if (isNewDay) {
        // Check if they posted yesterday to maintain streak
        if (lastStreakDate && lastStreakDate.getTime() === yesterday.getTime()) {
          newStreak += 1; // Continue streak
        } else if (!lastStreakDate || lastStreakDate.getTime() < yesterday.getTime()) {
          newStreak = 1; // Start new streak
        }
        // If they already posted today (lastStreakDate === today), keep current streak
      }
      
      // Update longest streak if current streak is now higher
      const newLongestStreak = Math.max(user[0].longestStreak || 0, newStreak);

      // Atomically increment the counter and update streak
      const newCount = isNewDay ? 1 : currentCount + 1;
      await tx.update(users)
        .set({
          dailyPostCount: newCount,
          lastPostDate: new Date(),
          currentStreak: newStreak,
          longestStreak: newLongestStreak,
          lastStreakDate: today,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Create the quote within the same transaction
      const result = await tx.insert(quotes).values(quoteData).returning();
      const quote = result[0];

      return { success: true, quote, remaining: 3 - newCount };
    });
  }

  // Quote methods
  async getQuote(id: string): Promise<Quote | undefined> {
    const result = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    return result[0];
  }

  async getAllQuotes(): Promise<QuoteWithAuthor[]> {
    const result = await db
      .select({
        id: quotes.id,
        text: quotes.text,
        authorId: quotes.authorId,
        createdAt: quotes.createdAt,
        voteCount: quotes.voteCount,
        authorUsername: users.username,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
        authorProfileImageUrl: users.profileImageUrl,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.authorId, users.id))
      .orderBy(desc(quotes.voteCount));
    
    return result as QuoteWithAuthor[];
  }

  async getQuotesByUser(userId: string): Promise<QuoteWithAuthor[]> {
    const result = await db
      .select({
        id: quotes.id,
        text: quotes.text,
        authorId: quotes.authorId,
        createdAt: quotes.createdAt,
        voteCount: quotes.voteCount,
        authorUsername: users.username,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
        authorProfileImageUrl: users.profileImageUrl,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.authorId, users.id))
      .where(eq(quotes.authorId, userId))
      .orderBy(desc(quotes.createdAt));
    
    return result as QuoteWithAuthor[];
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const result = await db.insert(quotes).values(insertQuote).returning();
    return result[0];
  }

  async updateQuote(id: string, data: Partial<Quote>): Promise<Quote> {
    const result = await db.update(quotes)
      .set(data)
      .where(eq(quotes.id, id))
      .returning();
    return result[0];
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  async getPersonalizedQuotes(userId: string): Promise<QuoteWithAuthor[]> {
    // Time window: last 14 days of quotes for performance
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Fetch recent quotes with author info
    let recentQuotes = await db
      .select({
        id: quotes.id,
        text: quotes.text,
        authorId: quotes.authorId,
        createdAt: quotes.createdAt,
        voteCount: quotes.voteCount,
        authorUsername: users.username,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
        authorProfileImageUrl: users.profileImageUrl,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.authorId, users.id))
      .where(sql`${quotes.createdAt} >= ${fourteenDaysAgo.toISOString()}`)
      .orderBy(desc(quotes.createdAt));

    // Fallback: if fewer than 20 quotes in window, fetch all quotes
    if (recentQuotes.length < 20) {
      recentQuotes = await db
        .select({
          id: quotes.id,
          text: quotes.text,
          authorId: quotes.authorId,
          createdAt: quotes.createdAt,
          voteCount: quotes.voteCount,
          authorUsername: users.username,
          authorFirstName: users.firstName,
          authorLastName: users.lastName,
          authorEmail: users.email,
          authorProfileImageUrl: users.profileImageUrl,
        })
        .from(quotes)
        .leftJoin(users, eq(quotes.authorId, users.id))
        .orderBy(desc(quotes.createdAt))
        .limit(100);
    }

    // Fetch user's voting history (upvotes only for affinity)
    const userVotes = await db
      .select({
        quoteId: votes.quoteId,
        authorId: quotes.authorId,
        value: votes.value,
      })
      .from(votes)
      .leftJoin(quotes, eq(votes.quoteId, quotes.id))
      .where(eq(votes.userId, userId));

    // Build author affinity map (count of upvotes per author)
    const authorAffinity = new Map<string, number>();
    const votedQuoteIds = new Set<string>();
    
    userVotes.forEach(vote => {
      votedQuoteIds.add(vote.quoteId);
      if (vote.value === 1 && vote.authorId) {
        authorAffinity.set(vote.authorId, (authorAffinity.get(vote.authorId) || 0) + 1);
      }
    });

    // Filter out quotes user already voted on
    const unvotedQuotes = recentQuotes.filter(q => !votedQuoteIds.has(q.id));

    // Scoring weights (configurable)
    const WEIGHTS = {
      authorAffinity: 0.40,
      recency: 0.30,
      engagement: 0.20,
      diversity: 0.10,
    };

    // Scoring constants
    const RECENCY_HALF_LIFE_DAYS = 7; // Exponential decay
    const OPTIMAL_VOTE_RANGE = [5, 50]; // Sweet spot for engagement
    const now = Date.now();

    // Pre-calculate author affinity normalization (hoist outside map)
    const affinityValues = Array.from(authorAffinity.values());
    const maxAffinity = affinityValues.length > 0 ? Math.max(...affinityValues) : 1;
    const hasAffinity = affinityValues.length > 0 && isFinite(maxAffinity) && maxAffinity > 0;

    // Calculate scores
    const scoredQuotes = unvotedQuotes.map(quote => {
      // 1. Author affinity score (normalized by max upvotes to any author)
      const affinityScore = hasAffinity ? (authorAffinity.get(quote.authorId) || 0) / maxAffinity : 0;

      // 2. Recency score (exponential decay)
      const ageInDays = (now - new Date(quote.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-ageInDays / RECENCY_HALF_LIFE_DAYS);

      // 3. Engagement score (bell curve around optimal range)
      let engagementScore = 0;
      const voteCount = quote.voteCount;
      if (voteCount >= OPTIMAL_VOTE_RANGE[0] && voteCount <= OPTIMAL_VOTE_RANGE[1]) {
        // In sweet spot - max score
        engagementScore = 1.0;
      } else if (voteCount < OPTIMAL_VOTE_RANGE[0]) {
        // Too few votes - scale up from 0
        engagementScore = voteCount / OPTIMAL_VOTE_RANGE[0];
      } else {
        // Too many votes - scale down from 1
        const excess = voteCount - OPTIMAL_VOTE_RANGE[1];
        engagementScore = Math.max(0, 1 - (excess / 100));
      }

      // 4. Combined score (diversity applied later)
      const baseScore = 
        (affinityScore * WEIGHTS.authorAffinity) +
        (recencyScore * WEIGHTS.recency) +
        (engagementScore * WEIGHTS.engagement);

      return {
        ...quote,
        _score: baseScore,
      };
    });

    // Sort by score descending
    scoredQuotes.sort((a, b) => b._score - a._score);

    // 5. Apply diversity penalty (single pass, track occurrences monotonically)
    const diversityPenalty = 0.3; // Reduce score by 30% for each repeat
    const authorOccurrences = new Map<string, number>();
    
    scoredQuotes.forEach(quote => {
      const previousOccurrences = authorOccurrences.get(quote.authorId) || 0;
      if (previousOccurrences > 0) {
        // Apply penalty for repeated authors (first occurrence = no penalty, second = 30% reduction, etc.)
        quote._score *= Math.pow(1 - diversityPenalty, previousOccurrences);
      }
      // Increment occurrence count for this author
      authorOccurrences.set(quote.authorId, previousOccurrences + 1);
    });

    // Re-sort after diversity penalty
    scoredQuotes.sort((a, b) => b._score - a._score);

    // Remove score field and return
    return scoredQuotes.map(({ _score, ...quote }) => quote) as QuoteWithAuthor[];
  }

  // Vote methods
  async getVote(quoteId: string, userId: string): Promise<Vote | undefined> {
    const result = await db.select().from(votes)
      .where(and(eq(votes.quoteId, quoteId), eq(votes.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createVote(insertVote: InsertVote): Promise<Vote> {
    const result = await db.insert(votes).values(insertVote).returning();
    
    // Update quote vote count
    const voteValue = insertVote.value;
    await db.update(quotes)
      .set({ voteCount: sql`${quotes.voteCount} + ${voteValue}` })
      .where(eq(quotes.id, insertVote.quoteId));
    
    return result[0];
  }

  async updateVote(id: string, value: number): Promise<Vote> {
    const oldVote = await db.select().from(votes).where(eq(votes.id, id)).limit(1);
    if (!oldVote[0]) throw new Error("Vote not found");
    
    const result = await db.update(votes)
      .set({ value })
      .where(eq(votes.id, id))
      .returning();
    
    // Update quote vote count (remove old vote, add new vote)
    const diff = value - oldVote[0].value;
    await db.update(quotes)
      .set({ voteCount: sql`${quotes.voteCount} + ${diff}` })
      .where(eq(quotes.id, oldVote[0].quoteId));
    
    return result[0];
  }

  async deleteVote(id: string): Promise<void> {
    const vote = await db.select().from(votes).where(eq(votes.id, id)).limit(1);
    if (!vote[0]) return;
    
    await db.delete(votes).where(eq(votes.id, id));
    
    // Update quote vote count
    await db.update(quotes)
      .set({ voteCount: sql`${quotes.voteCount} - ${vote[0].value}` })
      .where(eq(quotes.id, vote[0].quoteId));
  }

  // Product methods
  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return result[0];
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.createdAt));
  }

  async getActiveProducts(): Promise<Product[]> {
    return await db.select().from(products)
      .where(eq(products.isActive, true))
      .orderBy(desc(products.createdAt));
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(insertProduct).returning();
    return result[0];
  }

  async updateProductStatus(id: string, isActive: boolean): Promise<Product> {
    const result = await db.update(products)
      .set({ isActive })
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  // Order methods
  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return result[0];
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    return await db.select().from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(insertOrder).returning();
    return result[0];
  }

  async updateOrder(id: string, data: Partial<Order>): Promise<Order> {
    const result = await db.update(orders)
      .set(data)
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async updateOrderStatus(id: string, status: string, stripePaymentIntentId?: string): Promise<Order> {
    const updateData: any = { status };
    if (stripePaymentIntentId) {
      updateData.stripePaymentIntentId = stripePaymentIntentId;
    }
    
    const result = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  // Weekly Winner methods
  async getWeeklyWinner(id: string): Promise<WeeklyWinner | undefined> {
    const result = await db.select().from(weeklyWinners).where(eq(weeklyWinners.id, id)).limit(1);
    return result[0];
  }

  async getCurrentWeeklyWinner(): Promise<WeeklyWinner | undefined> {
    const now = new Date();
    const result = await db.select().from(weeklyWinners)
      .where(and(
        sql`${weeklyWinners.weekStartDate} <= ${now}`,
        sql`${weeklyWinners.weekEndDate} > ${now}`
      ))
      .limit(1);
    return result[0];
  }

  async getAllWeeklyWinners(): Promise<WeeklyWinner[]> {
    return await db.select().from(weeklyWinners).orderBy(desc(weeklyWinners.weekStartDate));
  }

  async getMostRecentWeeklyWinnerWithDetails(): Promise<any | undefined> {
    const result = await db
      .select({
        winnerId: weeklyWinners.id,
        quoteId: quotes.id,
        quoteText: quotes.text,
        voteCount: quotes.voteCount,
        authorId: users.id,
        authorUsername: users.username,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorProfileImageUrl: users.profileImageUrl,
        productId: products.id,
        productName: products.name,
        productPrice: products.price,
        productImageUrl: products.imageUrl,
        weekStartDate: weeklyWinners.weekStartDate,
        weekEndDate: weeklyWinners.weekEndDate,
        createdAt: weeklyWinners.createdAt,
      })
      .from(weeklyWinners)
      .innerJoin(quotes, eq(weeklyWinners.quoteId, quotes.id))
      .innerJoin(users, eq(quotes.authorId, users.id))
      .leftJoin(products, eq(products.weeklyWinnerId, weeklyWinners.id))
      .orderBy(desc(weeklyWinners.createdAt))
      .limit(1);
    
    return result[0];
  }

  async createWeeklyWinner(insertWinner: InsertWeeklyWinner): Promise<WeeklyWinner> {
    const result = await db.insert(weeklyWinners).values(insertWinner).returning();
    return result[0];
  }

  async updateWeeklyWinner(id: string, data: Partial<InsertWeeklyWinner>): Promise<WeeklyWinner> {
    const result = await db.update(weeklyWinners).set(data).where(eq(weeklyWinners.id, id)).returning();
    return result[0];
  }

  // Hall of Fame methods
  async getHallOfFame(): Promise<HallOfFame[]> {
    return await db.select().from(hallOfFame).orderBy(desc(hallOfFame.allTimeVoteCount));
  }

  async addToHallOfFame(insertEntry: InsertHallOfFame): Promise<HallOfFame> {
    const result = await db.insert(hallOfFame).values(insertEntry).returning();
    return result[0];
  }

  async getHallOfFameUsers(): Promise<any[]> {
    // Get user stats: weekly wins count and total votes
    const result = await db
      .select({
        userId: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        weeklyWins: sql<number>`CAST(COUNT(DISTINCT ${weeklyWinners.id}) AS INTEGER)`,
        totalVotes: sql<number>`CAST(COALESCE(SUM(${quotes.voteCount}), 0) AS INTEGER)`,
      })
      .from(users)
      .leftJoin(quotes, eq(quotes.authorId, users.id))
      .leftJoin(weeklyWinners, eq(weeklyWinners.quoteId, quotes.id))
      .groupBy(users.id, users.username, users.firstName, users.lastName, users.profileImageUrl)
      .orderBy(
        desc(sql`COUNT(DISTINCT ${weeklyWinners.id})`),
        desc(sql`COALESCE(SUM(${quotes.voteCount}), 0)`)
      );
    
    // Filter out users with no activity (0 wins and 0 votes)
    return result.filter(user => user.weeklyWins > 0 || user.totalVotes > 0);
  }

  // Follow methods
  async getFollow(followerId: string, followingId: string): Promise<Follow | undefined> {
    const result = await db.select().from(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      )
      .limit(1);
    return result[0];
  }

  async followUser(followerId: string, followingId: string): Promise<Follow> {
    const result = await db.insert(follows).values({
      followerId,
      followingId,
    }).onConflictDoNothing().returning();
    
    // If conflict (already following), fetch existing record
    if (!result[0]) {
      const existing = await this.getFollow(followerId, followingId);
      return existing!;
    }
    
    return result[0];
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await db.delete(follows)
      .where(
        and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );
  }

  async getFollowing(userId: string): Promise<(Follow & { following: User })[]> {
    const result = await db
      .select({
        id: follows.id,
        followerId: follows.followerId,
        followingId: follows.followingId,
        createdAt: follows.createdAt,
        following: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          dailyPostCount: users.dailyPostCount,
          lastPostDate: users.lastPostDate,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId));

    return result as any;
  }

  async getFollowers(userId: string): Promise<(Follow & { follower: User })[]> {
    const result = await db
      .select({
        id: follows.id,
        followerId: follows.followerId,
        followingId: follows.followingId,
        createdAt: follows.createdAt,
        follower: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          dailyPostCount: users.dailyPostCount,
          lastPostDate: users.lastPostDate,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        },
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId));

    return result as any;
  }

  async getFriends(userId: string): Promise<User[]> {
    // Get users that follow me
    const followers = await this.getFollowers(userId);
    const followerIds = followers.map(f => f.follower.id);

    // Get users I'm following
    const following = await this.getFollowing(userId);
    const followingIds = following.map(f => f.following.id);

    // Find mutual follows (friends)
    const mutualIds = followerIds.filter(id => followingIds.includes(id));

    if (mutualIds.length === 0) {
      return [];
    }

    // Get full user objects for friends
    const friends = await db.select().from(users).where(inArray(users.id, mutualIds));
    return friends;
  }

  async getFriendsQuotes(userId: string): Promise<QuoteWithAuthor[]> {
    // Get IDs of mutual friends
    const friendsList = await this.getFriends(userId);
    const friendIds = friendsList.map(f => f.id);
    
    if (friendIds.length === 0) {
      return [];
    }

    // Get quotes from friends
    const result = await db
      .select({
        id: quotes.id,
        text: quotes.text,
        authorId: quotes.authorId,
        createdAt: quotes.createdAt,
        voteCount: quotes.voteCount,
        authorUsername: users.username,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.authorId, users.id))
      .where(inArray(quotes.authorId, friendIds))
      .orderBy(desc(quotes.createdAt));
    
    return result as QuoteWithAuthor[];
  }
}

export const storage = new DbStorage();
