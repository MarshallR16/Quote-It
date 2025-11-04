# Quote-It

## Overview

Quote-It is a minimalist social media platform where users share quotes and thoughts, vote on posts, and purchase winning quotes as premium T-shirts. The platform features a clean, typography-first design inspired by Twitter's feed structure and Apple's minimalist aesthetic. Every week, the most voted quote is selected and made available as a merchandise item through Printful integration.

## Recent Changes (November 2025)

**Hall of Fame Update (Complete - November 4, 2025)**
- Redesigned Hall of Fame to track top users instead of individual quotes
- Users ranked by: 1) Number of weekly wins (most #1 shirts), 2) Total votes across all quotes
- API endpoint aggregates user statistics from weeklyWinners and quotes tables
- Leaderboard page displays user rankings with win count and total vote count
- Shows users with at least 1 win or votes (filters out inactive users)

**Referral System (Complete - November 4, 2025)**
- Each referral gives ONE discounted purchase at 10% off (not stacking)
- Users can earn multiple referrals and use them across multiple purchases
- Each successful purchase with discount uses one referral credit
- Each user receives a unique 8-character referral code on signup
- Referral codes use cryptographically secure randomness with collision detection
- New users can apply referral codes during signup
- Database fields: referralCode (unique), referredBy (referrer ID), referralCount (# of referrals), usedReferralDiscounts (# used)
- Profile page displays: total referrals, available discounts, and used discounts
- Checkout page shows discount breakdown when applicable (subtotal, discount %, final total)
- Server-side discount calculation checks available credits (referralCount - usedReferralDiscounts)
- After successful purchase with discount, usedReferralDiscounts is incremented
- API endpoint: POST /api/auth/apply-referral for applying codes

**Public Viewing (Complete - November 4, 2025)**
- App is now publicly viewable without requiring sign-in
- Anyone can browse quotes, leaderboard, and store without authentication
- Sign-in only required for interactions: posting quotes, voting, following users, and purchasing
- Unauthenticated users see "Sign In" button in navigation
- Vote buttons and profile actions redirect to login when not authenticated
- Friends navigation link hidden for non-authenticated users

**Firebase Authentication Migration (Complete)**
- Migrated from Replit Auth to Firebase Authentication for direct user sign-in
- Users can now sign in with Google and Apple without needing a Replit account
- Firebase Admin SDK integration for backend token verification
- Updated all API routes to use Firebase user IDs
- Login page with popup/redirect authentication flow

**Following System (Complete)**
- Replaced friend request system with Twitter-style following system
- Users can follow/unfollow others instantly (no pending requests)
- Mutual follows = friends (automatic when both users follow each other)
- New database table: follows (followerId, followingId, createdAt)
- API endpoints: /api/follow/:userId (POST=follow, DELETE=unfollow), /api/following, /api/followers, /api/friends (mutual follows)
- Feed tabs renamed: "Ranking" (top votes), "Following" (friends' quotes), "Rate It" (recent)
- GET /api/quotes/friends endpoint returns quotes from mutual follows

**Store Page Simplification**
- Removed large hero section (previously 400-500px) and "Shop the Collection" button
- Replaced with compact header banner (64px) for immediate product visibility
- Single product now displays above the fold, centered on page
- Simplified layout appropriate for one-product-at-a-time store model

**Navigation Enhancement**
- Added Store and Leaderboard links to desktop TopNavigation
- Logo is clickable to return to feed
- Improved desktop navigation UX with clear visual hierarchy

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Tooling**
- React with TypeScript for type safety and modern component development
- Vite as the build tool for fast development and optimized production builds
- Wouter for lightweight client-side routing
- TanStack Query for server state management and data fetching

**UI Component System**
- Shadcn/UI component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Custom design system defined in `design_guidelines.md` with brutalist touches and typography-first approach
- Font stack: Inter for UI elements, Space Grotesk for display typography

**State Management Strategy**
- TanStack Query for server state with configured defaults (no refetching, infinite stale time)
- React hooks for local component state
- Custom hooks for shared logic (useAuth, useIsMobile)

**Design Patterns**
- Component composition with reusable UI primitives
- Custom query client with centralized API request handling
- Optimistic updates for voting interactions to improve perceived performance
- Error boundaries and unauthorized error handling

### Backend Architecture

**Runtime & Framework**
- Node.js with Express server
- TypeScript throughout for type consistency between client and server
- ESM module system

**API Design**
- RESTful API endpoints organized in `/api` routes
- Session-based authentication using Replit's OpenID Connect
- Express middleware for request logging, JSON parsing, and raw body preservation (for webhook verification)

**Database Layer**
- Drizzle ORM for type-safe database operations
- Neon serverless PostgreSQL as the database provider
- WebSocket connection pooling for serverless environment
- Schema-first design with Zod validation

**Data Models**
- Users: Authentication and profile data with referral tracking (referralCode, referredBy, referralCount)
- Quotes: User-submitted content with vote tracking
- Votes: User voting records with cascade deletion
- Products: Printful-synced merchandise items
- Orders: Purchase records with Stripe payment tracking
- Weekly Winners: Historical record of winning quotes (links to quote and product)
- Hall of Fame: Legacy table (now unused, replaced by dynamic user rankings)
- Sessions: Persistent session storage for authentication

**Hall of Fame System**
- Dynamically calculates user rankings based on weekly wins and total votes
- Uses SQL aggregation across weeklyWinners and quotes tables
- Primary sort: number of weekly wins (DESC)
- Secondary sort: total votes across all user's quotes (DESC)
- Only displays users with activity (at least 1 win or votes)
- GET /api/hall-of-fame returns top users with stats

**Referral System**
- Cryptographically secure 8-character codes using base32 charset (excludes ambiguous characters)
- Collision detection with retry logic (up to 10 attempts)
- Referral tracking: referredBy links new users to their referrer
- Automatic referralCount increment when referral code is successfully applied
- Discount calculation: 10% if (referralCount - usedReferralDiscounts) > 0, applied server-side during checkout
- After successful purchase with discount, usedReferralDiscounts is automatically incremented
- Each referral = 1 discounted purchase, users can accumulate multiple discount credits
- Payment metadata includes discount information for audit trail

**Authentication Flow**
- Replit OpenID Connect integration via Passport.js strategy
- Session management with connect-pg-simple for PostgreSQL-backed sessions
- Token refresh handling with automatic session updates
- Protected routes using isAuthenticated middleware

### External Dependencies

**Payment Processing**
- Stripe integration for payment collection
- Client-side Elements for secure payment form rendering
- Server-side payment intent creation and verification
- Webhook support for payment status updates

**Print-on-Demand**
- Printful API integration for product creation and order fulfillment
- Automated product generation from winning quotes
- QR code generation for product linking
- Order status synchronization

**Authentication Service**
- Replit OpenID Connect for user authentication
- No password management required - delegated to Replit platform

**Database Provider**
- Neon serverless PostgreSQL with WebSocket support
- Connection pooling for optimal serverless performance

**Development Tools**
- Replit-specific Vite plugins for development experience (cartographer, dev-banner, runtime-error-modal)
- Drizzle Kit for database migrations and schema management

**Frontend Libraries**
- React Hook Form with Zod resolvers for form validation
- date-fns for date formatting and relative time display
- Axios for HTTP requests (primarily in Printful service)
- QRCode library for generating product QR codes

**Configuration Requirements**
- Environment variables required: DATABASE_URL, SESSION_SECRET, REPL_ID, ISSUER_URL
- Optional: STRIPE_SECRET_KEY, STRIPE_PUBLIC_KEY, PRINTFUL_API_TOKEN
- Graceful degradation when optional services are not configured