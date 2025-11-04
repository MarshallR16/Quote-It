# Quote-It

## Overview

Quote-It is a minimalist social media platform where users share quotes and thoughts, vote on posts, and purchase winning quotes as premium T-shirts. The platform features a clean, typography-first design inspired by Twitter's feed structure and Apple's minimalist aesthetic. Every week, the most voted quote is selected and made available as a merchandise item through Printful integration.

## Recent Changes (November 2025)

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
- Users: Authentication and profile data
- Quotes: User-submitted content with vote tracking
- Votes: User voting records with cascade deletion
- Products: Printful-synced merchandise items
- Orders: Purchase records with Stripe payment tracking
- Weekly Winners: Historical record of winning quotes
- Hall of Fame: Achievement tracking
- Sessions: Persistent session storage for authentication

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