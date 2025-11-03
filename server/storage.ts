import { type User, type UpsertUser, type Quote, type QuoteWithAuthor, type InsertQuote, type Vote, type InsertVote, type Product, type InsertProduct, type Order, type InsertOrder, type WeeklyWinner, type InsertWeeklyWinner, type HallOfFame, type InsertHallOfFame, users, quotes, votes, products, orders, weeklyWinners, hallOfFame } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  createQuoteWithLimitCheck(userId: string, quoteData: InsertQuote): Promise<{ success: boolean; quote?: Quote; remaining?: number; error?: string }>;

  // Quote methods
  getQuote(id: string): Promise<Quote | undefined>;
  getAllQuotes(): Promise<QuoteWithAuthor[]>;
  getQuotesByUser(userId: string): Promise<QuoteWithAuthor[]>;
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
  getAllWeeklyWinners(): Promise<WeeklyWinner[]>;
  createWeeklyWinner(winner: InsertWeeklyWinner): Promise<WeeklyWinner>;

  // Hall of Fame methods
  getHallOfFame(): Promise<HallOfFame[]>;
  addToHallOfFame(entry: InsertHallOfFame): Promise<HallOfFame>;
}

export class DbStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
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
    return result[0];
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
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

      // Atomically increment the counter
      const newCount = isNewDay ? 1 : currentCount + 1;
      await tx.update(users)
        .set({
          dailyPostCount: newCount,
          lastPostDate: new Date(),
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
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
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
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
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

  async createWeeklyWinner(insertWinner: InsertWeeklyWinner): Promise<WeeklyWinner> {
    const result = await db.insert(weeklyWinners).values(insertWinner).returning();
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
}

export const storage = new DbStorage();
