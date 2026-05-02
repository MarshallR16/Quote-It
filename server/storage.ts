import { type User, type UpsertUser, type Quote, type QuoteWithAuthor, type InsertQuote, type Vote, type InsertVote, type Product, type InsertProduct, type Order, type InsertOrder, type WeeklyWinner, type InsertWeeklyWinner, type HallOfFame, type InsertHallOfFame, type Follow, type InsertFollow, type Prize, type InsertPrize, type Comment, type InsertComment, type CommentVote, type InsertCommentVote, users, quotes, votes, products, orders, weeklyWinners, hallOfFame, follows, prizes, comments, commentVotes } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray, lt } from "drizzle-orm";

/**
 * ISO week identifier (e.g. "2026-W18") for the week containing the given date.
 * Mirrors Postgres's `to_char(d, 'IYYY"-W"IW')` so app-side and DB-side agree.
 */
export function isoWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO week: Thursday in current week decides the year.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUserWithAutoAdmin(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  updateUserProfileImage(userId: string, profileImageUrl: string): Promise<void>;
  incrementReferralCount(userId: string): Promise<void>;
  incrementUsedReferralDiscounts(userId: string): Promise<void>;
  createQuoteWithLimitCheck(userId: string, quoteData: Omit<InsertQuote, 'postedForWeekId'>): Promise<{ success: boolean; quote?: Quote; remaining?: number; remainingThisWeek?: number; error?: string }>;
  deleteUser(userId: string): Promise<void>;
  deleteQuotesByAuthor(authorId: string): Promise<void>;
  deleteUserQuotesAndRelatedData(authorId: string): Promise<void>;
  anonymizeUserOrders(userId: string): Promise<void>;
  isFirstUser(): Promise<boolean>;
  userHasWeeklyWinners(userId: string): Promise<boolean>;

  // Quote methods
  getQuote(id: string): Promise<Quote | undefined>;
  getAllQuotes(): Promise<QuoteWithAuthor[]>;
  getQuotesByUser(userId: string): Promise<QuoteWithAuthor[]>;
  getPersonalizedQuotes(userId: string): Promise<QuoteWithAuthor[]>;
  getEligibleQuotes(): Promise<QuoteWithAuthor[]>;
  getCurrentWeekQuotes(): Promise<QuoteWithAuthor[]>;
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
  updateProduct(id: string, data: Partial<Product>): Promise<Product>;
  updateProductStatus(id: string, isActive: boolean): Promise<Product>;

  // Order methods
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByPaymentIntentId(paymentIntentId: string): Promise<Order | undefined>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<Order>): Promise<Order>;
  updateOrderStatus(id: string, status: string, stripePaymentIntentId?: string): Promise<Order>;

  // Weekly Winner methods
  getWeeklyWinner(id: string): Promise<WeeklyWinner | undefined>;
  getCurrentWeeklyWinner(): Promise<WeeklyWinner | undefined>;
  getMostRecentWeeklyWinnerWithDetails(): Promise<any | undefined>;
  getAllWeeklyWinners(): Promise<WeeklyWinner[]>;
  getAllWeeklyWinnersWithDetails(): Promise<any[]>;
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
  getFollowingQuotes(userId: string): Promise<QuoteWithAuthor[]>;

  // Search methods
  searchUsers(query: string, limit?: number): Promise<User[]>;

  // Quote deletion helpers
  isQuoteWeeklyWinner(quoteId: string): Promise<boolean>;

  // Get weekly winner by quote ID (for reconciliation)
  getWeeklyWinnerByQuoteId(quoteId: string): Promise<WeeklyWinner | undefined>;

  // Prize methods (winner's free-gold-tee voucher)
  getPrize(id: string): Promise<Prize | undefined>;
  getPrizeByWeeklyWinner(weeklyWinnerId: string): Promise<Prize | undefined>;
  getPrizesByUser(userId: string): Promise<Prize[]>;
  getPendingPrizeForUser(userId: string): Promise<Prize | undefined>;
  createPrize(prize: InsertPrize): Promise<Prize>;
  claimPrize(prizeId: string, orderId: string): Promise<Prize>;
  expireStalePrizes(): Promise<number>;

  // Comment methods
  getComment(id: string): Promise<Comment | undefined>;
  getCommentsByQuote(quoteId: string): Promise<(Comment & { authorUsername: string | null; authorProfileImageUrl: string | null })[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  updateComment(id: string, text: string): Promise<Comment>;
  softDeleteComment(id: string): Promise<Comment>;

  // Comment vote methods
  getCommentVote(commentId: string, userId: string): Promise<CommentVote | undefined>;
  createCommentVote(vote: InsertCommentVote): Promise<CommentVote>;
  updateCommentVote(id: string, value: number): Promise<CommentVote>;
  deleteCommentVote(id: string): Promise<void>;
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

  async createUserWithAutoAdmin(userData: UpsertUser): Promise<User> {
    // Use a transaction with table-level lock to atomically check if this is the first user
    return await db.transaction(async (tx) => {
      // First check if user already exists
      const existingUserResult = await tx.select().from(users).where(eq(users.id, userData.id as string)).limit(1);
      
      // If user exists, just update their info but preserve isAdmin flag
      if (existingUserResult.length > 0) {
        const existingUser = existingUserResult[0];
        const result = await tx.update(users)
          .set({
            ...userData,
            // Preserve existing isAdmin status - don't recalculate
            isAdmin: existingUser.isAdmin,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userData.id as string))
          .returning();
        return result[0] as User;
      }
      
      // User doesn't exist - need to create with auto-admin check
      // Acquire table-level lock to prevent concurrent inserts during first-user check
      // SHARE ROW EXCLUSIVE MODE prevents other transactions from acquiring locks that would allow writes
      await tx.execute(sql`LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE`);
      
      // Now check if any users exist - lock guarantees no concurrent inserts
      const allUsers = await tx.select().from(users).limit(1);
      const isFirstUser = allUsers.length === 0;
      
      console.log('[STORAGE] Is first user:', isFirstUser);
      
      // Create user with isAdmin flag if first user
      const userDataWithAdmin = {
        ...userData,
        isAdmin: isFirstUser,
      };
      
      const result = await tx
        .insert(users)
        .values(userDataWithAdmin)
        .returning();
      
      return result[0] as User;
    });
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

  async deleteUser(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  async deleteQuotesByAuthor(authorId: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.authorId, authorId));
  }

  async deleteUserQuotesAndRelatedData(authorId: string): Promise<void> {
    // Get all quote IDs by this author
    const userQuotes = await db.select({ id: quotes.id }).from(quotes).where(eq(quotes.authorId, authorId));
    const quoteIds = userQuotes.map(q => q.id);
    
    if (quoteIds.length > 0) {
      // Get all weekly winners that reference these quotes
      const winners = await db.select({ id: weeklyWinners.id, productId: weeklyWinners.productId, winnerProductId: weeklyWinners.winnerProductId })
        .from(weeklyWinners)
        .where(inArray(weeklyWinners.quoteId, quoteIds));
      
      // Delete products associated with these weekly winners
      for (const winner of winners) {
        if (winner.productId) {
          await db.delete(products).where(eq(products.id, winner.productId));
        }
        if (winner.winnerProductId) {
          await db.delete(products).where(eq(products.id, winner.winnerProductId));
        }
      }
      
      // Delete weekly winners
      await db.delete(weeklyWinners).where(inArray(weeklyWinners.quoteId, quoteIds));
      
      // Delete the quotes
      await db.delete(quotes).where(eq(quotes.authorId, authorId));
    }
  }

  async anonymizeUserOrders(userId: string): Promise<void> {
    // Keep orders for tax/legal reasons but remove personal identifiers
    await db.update(orders)
      .set({ 
        shippingAddress: null,
        // Don't change userId - keep for data integrity but user will be deleted
      })
      .where(eq(orders.userId, userId));
  }

  async isFirstUser(): Promise<boolean> {
    // Check if there are any users in the database
    const result = await db.select().from(users).limit(1);
    return result.length === 0;
  }

  async userHasWeeklyWinners(userId: string): Promise<boolean> {
    // Check if user has any quotes that have been weekly winners
    const userQuotes = await db.select({ id: quotes.id }).from(quotes).where(eq(quotes.authorId, userId));
    if (userQuotes.length === 0) return false;
    
    const quoteIds = userQuotes.map(q => q.id);
    const winners = await db.select({ id: weeklyWinners.id })
      .from(weeklyWinners)
      .where(inArray(weeklyWinners.quoteId, quoteIds))
      .limit(1);
    
    return winners.length > 0;
  }

  async createQuoteWithLimitCheck(
    userId: string,
    quoteData: Omit<InsertQuote, 'postedForWeekId'>,
  ): Promise<{ success: boolean; quote?: Quote; remaining?: number; remainingThisWeek?: number; error?: string }> {
    const weekId = isoWeekId();
    const DAILY_LIMIT = 3;
    const WEEKLY_LIMIT = 10;
    // Use a transaction to atomically check both daily + weekly limits and create the quote
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

      // Daily cap (carried over from prior behavior)
      if (currentCount >= DAILY_LIMIT) {
        return { success: false, remaining: 0, error: "Daily limit reached" };
      }

      // Weekly cap (new): count this user's quotes already posted for the current week.
      // Same transaction so concurrent inserts can't race past the limit.
      const weeklyCountResult = await tx
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(quotes)
        .where(and(eq(quotes.authorId, userId), eq(quotes.postedForWeekId, weekId)));
      const weeklyCount = weeklyCountResult[0]?.count || 0;

      if (weeklyCount >= WEEKLY_LIMIT) {
        return {
          success: false,
          remainingThisWeek: 0,
          error: "Weekly quote limit reached (10 per week)",
        };
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
        if (lastStreakDate && lastStreakDate.getTime() === yesterday.getTime()) {
          newStreak += 1;
        } else if (!lastStreakDate || lastStreakDate.getTime() < yesterday.getTime()) {
          newStreak = 1;
        }
      }

      const newLongestStreak = Math.max(user[0].longestStreak || 0, newStreak);
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

      const result = await tx.insert(quotes).values({
        ...quoteData,
        postedForWeekId: weekId,
      }).returning();
      const quote = result[0];

      return {
        success: true,
        quote,
        remaining: DAILY_LIMIT - newCount,
        remainingThisWeek: WEEKLY_LIMIT - (weeklyCount + 1),
      };
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

  async getCurrentWeekQuotes(): Promise<QuoteWithAuthor[]> {
    // Calculate current week boundaries (Monday 00:00:00 to Sunday 23:59:59)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate Monday of current week
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    
    // Calculate Sunday end of current week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

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
      .where(sql`${quotes.createdAt} >= ${weekStart.toISOString()} AND ${quotes.createdAt} <= ${weekEnd.toISOString()}`)
      .orderBy(desc(quotes.voteCount));
    
    return result as QuoteWithAuthor[];
  }

  async getEligibleQuotes(): Promise<QuoteWithAuthor[]> {
    // Get quotes from the last 7 days that haven't won yet
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Get all quote IDs that have already won
    const winningQuoteIds = await db
      .select({ quoteId: weeklyWinners.quoteId })
      .from(weeklyWinners);
    
    const winnerIds = winningQuoteIds.map(w => w.quoteId);

    // Build the query
    let query = db
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
      .leftJoin(users, eq(quotes.authorId, users.id));

    // Filter: posted in last 7 days AND not already a winner
    let result;
    if (winnerIds.length > 0) {
      result = await query
        .where(sql`${quotes.createdAt} >= ${sevenDaysAgo.toISOString()} AND ${quotes.id} NOT IN (${sql.join(winnerIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(quotes.voteCount));
    } else {
      result = await query
        .where(sql`${quotes.createdAt} >= ${sevenDaysAgo.toISOString()}`)
        .orderBy(desc(quotes.voteCount));
    }
    
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
    // Time window: last 7 days of quotes for eligibility
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Get all quote IDs that have already won (to exclude them)
    const winningQuoteIds = await db
      .select({ quoteId: weeklyWinners.quoteId })
      .from(weeklyWinners);
    const winnerIds = winningQuoteIds.map(w => w.quoteId);

    // Fetch recent eligible quotes with author info (last 7 days, not already won)
    let recentQuotes;
    if (winnerIds.length > 0) {
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
        .where(sql`${quotes.createdAt} >= ${sevenDaysAgo.toISOString()} AND ${quotes.id} NOT IN (${sql.join(winnerIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(quotes.createdAt));
    } else {
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
        .where(sql`${quotes.createdAt} >= ${sevenDaysAgo.toISOString()}`)
        .orderBy(desc(quotes.createdAt));
    }

    // Fallback: if fewer than 20 eligible quotes, still only show eligible ones (no fallback to all)
    // This ensures consistency - quotes always stay for exactly 7 days

    // Fetch user's voting history - FIXED: Split into two queries to avoid Drizzle LEFT JOIN bug
    // First, get just the votes for this user
    const userVotesRaw = await db
      .select({
        quoteId: votes.quoteId,
        value: votes.value,
      })
      .from(votes)
      .where(eq(votes.userId, userId));

    // Build voted quote IDs set
    const votedQuoteIds = new Set<string>();
    const voteQuoteIds = userVotesRaw.map(v => {
      votedQuoteIds.add(v.quoteId);
      return v.quoteId;
    });

    // Second, get author IDs for those voted quotes (for affinity scoring)
    const authorAffinity = new Map<string, number>();
    if (voteQuoteIds.length > 0) {
      const quotesForAffinity = await db
        .select({
          quoteId: quotes.id,
          authorId: quotes.authorId,
        })
        .from(quotes)
        .where(inArray(quotes.id, voteQuoteIds));

      // Build affinity map from upvotes only
      const upvotes = userVotesRaw.filter(v => v.value === 1);
      upvotes.forEach(vote => {
        const quoteInfo = quotesForAffinity.find(q => q.quoteId === vote.quoteId);
        if (quoteInfo && quoteInfo.authorId) {
          authorAffinity.set(quoteInfo.authorId, (authorAffinity.get(quoteInfo.authorId) || 0) + 1);
        }
      });
    }

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

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const result = await db.update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
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

  async getOrderByPaymentIntentId(paymentIntentId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders)
      .where(eq(orders.stripePaymentIntentId, paymentIntentId))
      .limit(1);
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
        productDescription: products.description,
        productPrice: products.price,
        productImageUrl: products.imageUrl,
        productIsActive: products.isActive,
        weekStartDate: weeklyWinners.weekStartDate,
        weekEndDate: weeklyWinners.weekEndDate,
        finalVoteCount: weeklyWinners.finalVoteCount,
        createdAt: weeklyWinners.createdAt,
      })
      .from(weeklyWinners)
      .innerJoin(quotes, eq(weeklyWinners.quoteId, quotes.id))
      .innerJoin(users, eq(quotes.authorId, users.id))
      .leftJoin(products, and(
        eq(products.weeklyWinnerId, weeklyWinners.id),
        eq(products.isActive, true)
      ))
      .orderBy(desc(weeklyWinners.createdAt))
      .limit(1);
    
    return result[0];
  }

  async getAllWeeklyWinnersWithDetails(): Promise<any[]> {
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
        productDescription: products.description,
        productPrice: products.price,
        productImageUrl: products.imageUrl,
        productIsActive: products.isActive,
        weekStartDate: weeklyWinners.weekStartDate,
        weekEndDate: weeklyWinners.weekEndDate,
        finalVoteCount: weeklyWinners.finalVoteCount,
        createdAt: weeklyWinners.createdAt,
      })
      .from(weeklyWinners)
      .innerJoin(quotes, eq(weeklyWinners.quoteId, quotes.id))
      .innerJoin(users, eq(quotes.authorId, users.id))
      .leftJoin(products, and(
        eq(products.weeklyWinnerId, weeklyWinners.id),
        eq(products.isActive, true)
      ))
      .orderBy(desc(weeklyWinners.createdAt));
    
    // Deduplicate by quoteId - prevents the same quote from appearing multiple times in archive
    // This can happen if there are data issues with multiple weekly_winner entries for the same quote
    // We keep the MOST RECENT winner entry for each quote (based on weekEndDate)
    const seenQuotes = new Map<string, any>();
    for (const item of result) {
      const existing = seenQuotes.get(item.quoteId);
      if (!existing || new Date(item.weekEndDate) > new Date(existing.weekEndDate)) {
        seenQuotes.set(item.quoteId, item);
      }
    }
    
    // Return deduplicated results, sorted by most recent first
    const deduplicated = Array.from(seenQuotes.values()).sort((a, b) => 
      new Date(b.weekEndDate).getTime() - new Date(a.weekEndDate).getTime()
    );
    
    return deduplicated;
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

    // Calculate 7 days ago for eligibility
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Get all quote IDs that have already won
    const winningQuoteIds = await db
      .select({ quoteId: weeklyWinners.quoteId })
      .from(weeklyWinners);
    const winnerIds = winningQuoteIds.map(w => w.quoteId);

    // Get quotes from friends (last 7 days, not already won)
    let result;
    if (winnerIds.length > 0) {
      result = await db
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
        .where(sql`${quotes.authorId} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)}) AND ${quotes.createdAt} >= ${sevenDaysAgo.toISOString()} AND ${quotes.id} NOT IN (${sql.join(winnerIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(quotes.createdAt));
    } else {
      result = await db
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
        .where(sql`${quotes.authorId} IN (${sql.join(friendIds.map(id => sql`${id}`), sql`, `)}) AND ${quotes.createdAt} >= ${sevenDaysAgo.toISOString()}`)
        .orderBy(desc(quotes.createdAt));
    }
    
    return result as QuoteWithAuthor[];
  }

  async getFollowingQuotes(userId: string): Promise<QuoteWithAuthor[]> {
    // Get IDs of everyone I'm following
    const followingList = await this.getFollowing(userId);
    const followingIds = followingList.map(f => f.following.id);
    
    if (followingIds.length === 0) {
      return [];
    }

    // Calculate 7 days ago for eligibility
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Get all quote IDs that have already won
    const winningQuoteIds = await db
      .select({ quoteId: weeklyWinners.quoteId })
      .from(weeklyWinners);
    const winnerIds = winningQuoteIds.map(w => w.quoteId);

    // Get quotes from people I follow (last 7 days, not already won)
    let result;
    if (winnerIds.length > 0) {
      result = await db
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
        .where(sql`${quotes.authorId} IN (${sql.join(followingIds.map(id => sql`${id}`), sql`, `)}) AND ${quotes.createdAt} >= ${sevenDaysAgo.toISOString()} AND ${quotes.id} NOT IN (${sql.join(winnerIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(desc(quotes.createdAt));
    } else {
      result = await db
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
        .where(sql`${quotes.authorId} IN (${sql.join(followingIds.map(id => sql`${id}`), sql`, `)}) AND ${quotes.createdAt} >= ${sevenDaysAgo.toISOString()}`)
        .orderBy(desc(quotes.createdAt));
    }
    
    return result as QuoteWithAuthor[];
  }

  // Search methods
  async searchUsers(query: string, limit: number = 20): Promise<User[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }
    
    const searchTerm = `%${query.trim().toLowerCase()}%`;
    
    const result = await db
      .select()
      .from(users)
      .where(
        sql`(LOWER(${users.firstName}) LIKE ${searchTerm} 
          OR LOWER(${users.lastName}) LIKE ${searchTerm} 
          OR LOWER(${users.username}) LIKE ${searchTerm}
          OR LOWER(CONCAT(${users.firstName}, ' ', ${users.lastName})) LIKE ${searchTerm})`
      )
      .limit(limit);
    
    return result;
  }

  // Quote deletion helpers
  async isQuoteWeeklyWinner(quoteId: string): Promise<boolean> {
    const result = await db
      .select({ id: weeklyWinners.id })
      .from(weeklyWinners)
      .where(eq(weeklyWinners.quoteId, quoteId))
      .limit(1);
    
    return result.length > 0;
  }

  async getWeeklyWinnerByQuoteId(quoteId: string): Promise<WeeklyWinner | undefined> {
    const result = await db
      .select()
      .from(weeklyWinners)
      .where(eq(weeklyWinners.quoteId, quoteId))
      .orderBy(desc(weeklyWinners.createdAt))
      .limit(1);

    return result[0];
  }

  // ===================================================
  // Prizes
  // ===================================================

  async getPrize(id: string): Promise<Prize | undefined> {
    const result = await db.select().from(prizes).where(eq(prizes.id, id)).limit(1);
    return result[0];
  }

  async getPrizeByWeeklyWinner(weeklyWinnerId: string): Promise<Prize | undefined> {
    const result = await db
      .select()
      .from(prizes)
      .where(eq(prizes.weeklyWinnerId, weeklyWinnerId))
      .limit(1);
    return result[0];
  }

  async getPrizesByUser(userId: string): Promise<Prize[]> {
    return await db
      .select()
      .from(prizes)
      .where(eq(prizes.userId, userId))
      .orderBy(desc(prizes.createdAt));
  }

  async getPendingPrizeForUser(userId: string): Promise<Prize | undefined> {
    const result = await db
      .select()
      .from(prizes)
      .where(and(eq(prizes.userId, userId), eq(prizes.status, "unclaimed")))
      .orderBy(desc(prizes.createdAt))
      .limit(1);
    return result[0];
  }

  async createPrize(prize: InsertPrize): Promise<Prize> {
    const result = await db.insert(prizes).values(prize).returning();
    return result[0];
  }

  async claimPrize(prizeId: string, orderId: string): Promise<Prize> {
    // Atomic transition: only flips unclaimed -> claimed; idempotent for the
    // pathological "two confirms hit at once" case.
    const result = await db
      .update(prizes)
      .set({
        status: "claimed",
        claimedAt: new Date(),
        orderId,
      })
      .where(and(eq(prizes.id, prizeId), eq(prizes.status, "unclaimed")))
      .returning();
    if (!result[0]) {
      // Either already claimed/expired or doesn't exist - re-read to surface state.
      const existing = await this.getPrize(prizeId);
      if (!existing) throw new Error(`Prize ${prizeId} not found`);
      return existing;
    }
    return result[0];
  }

  async expireStalePrizes(): Promise<number> {
    const result = await db
      .update(prizes)
      .set({ status: "expired" })
      .where(and(eq(prizes.status, "unclaimed"), lt(prizes.expiresAt, new Date())))
      .returning({ id: prizes.id });
    return result.length;
  }

  // ===================================================
  // Comments
  // ===================================================

  async getComment(id: string): Promise<Comment | undefined> {
    const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return result[0];
  }

  async getCommentsByQuote(quoteId: string): Promise<(Comment & { authorUsername: string | null; authorProfileImageUrl: string | null })[]> {
    const result = await db
      .select({
        id: comments.id,
        quoteId: comments.quoteId,
        userId: comments.userId,
        text: comments.text,
        score: comments.score,
        createdAt: comments.createdAt,
        editedAt: comments.editedAt,
        deletedAt: comments.deletedAt,
        authorUsername: users.username,
        authorProfileImageUrl: users.profileImageUrl,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(and(eq(comments.quoteId, quoteId), sql`${comments.deletedAt} IS NULL`))
      .orderBy(desc(comments.createdAt));
    return result as any;
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const result = await db.insert(comments).values(comment).returning();
    return result[0];
  }

  async updateComment(id: string, text: string): Promise<Comment> {
    const result = await db
      .update(comments)
      .set({ text, editedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
    return result[0];
  }

  async softDeleteComment(id: string): Promise<Comment> {
    const result = await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
    return result[0];
  }

  // ===================================================
  // Comment votes (mirrors votes/quote score updates)
  // ===================================================

  async getCommentVote(commentId: string, userId: string): Promise<CommentVote | undefined> {
    const result = await db
      .select()
      .from(commentVotes)
      .where(and(eq(commentVotes.commentId, commentId), eq(commentVotes.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createCommentVote(vote: InsertCommentVote): Promise<CommentVote> {
    return await db.transaction(async (tx) => {
      const inserted = await tx.insert(commentVotes).values(vote).returning();
      await tx
        .update(comments)
        .set({ score: sql`${comments.score} + ${vote.value}` })
        .where(eq(comments.id, vote.commentId));
      return inserted[0];
    });
  }

  async updateCommentVote(id: string, value: number): Promise<CommentVote> {
    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(commentVotes).where(eq(commentVotes.id, id)).limit(1);
      if (!existing[0]) throw new Error("Comment vote not found");
      const oldValue = existing[0].value;
      const updated = await tx
        .update(commentVotes)
        .set({ value })
        .where(eq(commentVotes.id, id))
        .returning();
      const diff = value - oldValue;
      if (diff !== 0) {
        await tx
          .update(comments)
          .set({ score: sql`${comments.score} + ${diff}` })
          .where(eq(comments.id, existing[0].commentId));
      }
      return updated[0];
    });
  }

  async deleteCommentVote(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const existing = await tx.select().from(commentVotes).where(eq(commentVotes.id, id)).limit(1);
      if (!existing[0]) return;
      await tx.delete(commentVotes).where(eq(commentVotes.id, id));
      await tx
        .update(comments)
        .set({ score: sql`${comments.score} - ${existing[0].value}` })
        .where(eq(comments.id, existing[0].commentId));
    });
  }
}

export const storage = new DbStorage();
