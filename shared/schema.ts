import { sql } from "drizzle-orm";
import { pgTable, pgEnum, text, varchar, integer, smallint, timestamp, boolean, decimal, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =====================================================
// Enums
// =====================================================

export const productVariantEnum = pgEnum("product_variant", [
  "white",
  "black",
  "gold_winner",
]);

export const prizeStatusEnum = pgEnum("prize_status", [
  "unclaimed",
  "claimed",
  "expired",
]);

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  username: varchar("username").notNull().unique(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").notNull().default(false),
  dailyPostCount: integer("daily_post_count").notNull().default(0),
  lastPostDate: timestamp("last_post_date"),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastStreakDate: timestamp("last_streak_date"),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  referralCode: varchar("referral_code").unique(),
  referredBy: varchar("referred_by"),
  referralCount: integer("referral_count").notNull().default(0),
  usedReferralDiscounts: integer("used_referral_discounts").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  authorId: varchar("author_id").notNull().references(() => users.id),
  // ISO week identifier (e.g. "2026-W18") that this quote competes in.
  // App-layer 10/week cap is keyed on (authorId, postedForWeekId).
  postedForWeekId: text("posted_for_week_id").notNull(),
  // If a quote was carried over from a prior week (didn't win, still eligible),
  // this records the previous week so we can show provenance / prevent loops.
  rolledOverFromWeekId: text("rolled_over_from_week_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  voteCount: integer("vote_count").notNull().default(0),
}, (table) => ({
  // Hot path: "show me current week's quotes ranked by votes"
  weekScoreIdx: index("quotes_week_score_idx").on(table.postedForWeekId, sql`${table.voteCount} DESC`),
  authorIdx: index("quotes_author_idx").on(table.authorId),
}));

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  voteCount: true,
});

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// Quote with author information for display
export type QuoteWithAuthor = Quote & {
  authorUsername: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
  authorProfileImageUrl: string | null;
};

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(), // 1 for upvote, -1 for downvote
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueVoter: uniqueIndex("uniq_votes_quote_user").on(table.quoteId, table.userId),
}));

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  createdAt: true,
});

export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;

export const weeklyWinners = pgTable("weekly_winners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Stable ISO week identifier (e.g. "2026-W18") - one winner per week.
  weekId: text("week_id").notNull().unique(),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  // Denormalized author of the winning quote, for fast "is this user a winner?" checks
  // without joining quotes -> users on every page render.
  winnerUserId: varchar("winner_user_id").notNull().references(() => users.id),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  finalVoteCount: integer("final_vote_count").notNull(),
  productId: varchar("product_id"), // White text version (for store) - manual FK to avoid circular reference
  winnerProductId: varchar("winner_product_id"), // Gold text version (for winner) - manual FK to avoid circular reference
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWeeklyWinnerSchema = createInsertSchema(weeklyWinners).omit({
  id: true,
  createdAt: true,
});

export type InsertWeeklyWinner = z.infer<typeof insertWeeklyWinnerSchema>;
export type WeeklyWinner = typeof weeklyWinners.$inferSelect;

export const hallOfFame = pgTable("hall_of_fame", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  inductedAt: timestamp("inducted_at").notNull().defaultNow(),
  allTimeVoteCount: integer("all_time_vote_count").notNull(),
});

export const insertHallOfFameSchema = createInsertSchema(hallOfFame).omit({
  id: true,
  inductedAt: true,
});

export type InsertHallOfFame = z.infer<typeof insertHallOfFameSchema>;
export type HallOfFame = typeof hallOfFame.$inferSelect;

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  weeklyWinnerId: varchar("weekly_winner_id").references(() => weeklyWinners.id),
  // Replaces the prior "infer variant from name string" pattern. Use this
  // instead of `name.includes('Gold Edition')` etc.
  variant: productVariantEnum("variant").notNull(),
  // gold_winner products are exclusive (winner-only, never for sale).
  // Replaces the previous overload where gold = isActive=false.
  isExclusive: boolean("is_exclusive").notNull().default(false),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  printfulSyncProductId: integer("printful_sync_product_id"),
  printfulSyncVariants: jsonb("printful_sync_variants"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  winnerIdx: index("products_weekly_winner_idx").on(table.weeklyWinnerId),
}));

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// A reservation/voucher for a winner to claim their gold tee. Lives separately
// from `orders` so that `orders` rows always represent real, addressed orders -
// the "no shipping address yet" state lives here, not on orders.
export const prizes = pgTable("prizes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weeklyWinnerId: varchar("weekly_winner_id").notNull().references(() => weeklyWinners.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // The gold-tee product this prize redeems for.
  productId: varchar("product_id").notNull().references(() => products.id),
  status: prizeStatusEnum("status").notNull().default("unclaimed"),
  expiresAt: timestamp("expires_at").notNull(),
  claimedAt: timestamp("claimed_at"),
  // Set when the winner submits a shipping address; the order is the
  // physical fulfillment record. Nullable because unclaimed/expired prizes
  // never produce an order.
  orderId: varchar("order_id").references(() => orders.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // One prize per winner row (the winner gets exactly one gold tee).
  uniqueWinner: uniqueIndex("uniq_prizes_weekly_winner").on(table.weeklyWinnerId),
  userIdx: index("prizes_user_idx").on(table.userId),
  expiryIdx: index("prizes_status_expiry_idx").on(table.status, table.expiresAt),
}));

export const insertPrizeSchema = createInsertSchema(prizes).omit({
  id: true,
  createdAt: true,
  claimedAt: true,
  orderId: true,
});

export type InsertPrize = z.infer<typeof insertPrizeSchema>;
export type Prize = typeof prizes.$inferSelect;

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  printfulOrderId: integer("printful_order_id"),
  shippingAddress: jsonb("shipping_address"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  // Real orders are always addressed: pending -> paid -> processing -> completed,
  // or paid -> failed / printful_error / pending_confirmation. The legacy
  // 'awaiting_address' state was migrated out (lives on `prizes` now).
  status: text("status").notNull().default("pending"),
  // True when this order was generated to fulfill a prize (winner's free gold tee).
  // Replaces the prior `isComplimentary` column with semantics tied to a specific prize.
  isPrizeFulfillment: boolean("is_prize_fulfillment").notNull().default(false),
  includeAuthor: boolean("include_author").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Postgres treats NULL as distinct in a unique index, so prize-fulfillment orders
  // (which have NULL stripePaymentIntentId) are unaffected. Real intent IDs are unique.
  uniqueStripePaymentIntent: uniqueIndex("uniq_orders_stripe_payment_intent_id")
    .on(table.stripePaymentIntentId),
}));

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Flat (non-threaded) comments on a quote. Soft-deletable via deletedAt;
// the 15-minute edit window is enforced at the route layer, not the DB.
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  // Denormalized score updated app-side inside the same tx as comment_votes,
  // matching the existing votes -> quotes.voteCount pattern.
  score: integer("score").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
}, (table) => ({
  quoteRecentIdx: index("comments_quote_created_idx").on(table.quoteId, sql`${table.createdAt} DESC`),
}));

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  editedAt: true,
  deletedAt: true,
  score: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

export const commentVotes = pgTable("comment_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commentId: varchar("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: smallint("value").notNull(), // 1 or -1
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueVoter: uniqueIndex("uniq_comment_votes_comment_user").on(table.commentId, table.userId),
}));

export const insertCommentVoteSchema = createInsertSchema(commentVotes).omit({
  id: true,
  createdAt: true,
});

export type InsertCommentVote = z.infer<typeof insertCommentVoteSchema>;
export type CommentVote = typeof commentVotes.$inferSelect;

export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: varchar("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueFollowerFollowing: uniqueIndex("unique_follower_following").on(table.followerId, table.followingId),
}));

export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof follows.$inferSelect;
