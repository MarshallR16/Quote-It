# Quote-It

## Overview

Quote-It is a minimalist social media platform where users share quotes and thoughts, vote on posts, and purchase winning quotes as premium T-shirts. The platform aims to combine social interaction with a unique merchandise integration, featuring a clean, typography-first design. Each week, the most voted quote is selected and made available as a merchandise item through Printful integration, allowing users to earn a free shirt if their quote wins. The project also supports iOS via Capacitor, offers a referral system, and includes an admin panel for platform management and analytics.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite for fast builds. UI components are developed with Shadcn/UI (based on Radix UI) and styled with Tailwind CSS, following a custom design system with brutalist and typography-first elements. Wouter handles client-side routing, and TanStack Query manages server state and data fetching. The application uses component composition, custom hooks, optimistic updates for interactions, and error boundaries.

### Backend Architecture

The backend utilizes Node.js with Express and TypeScript, running on an ESM module system. It provides a RESTful API. The database layer uses Drizzle ORM with Neon serverless PostgreSQL, supporting type-safe operations and connection pooling. Data models include Users (with referral tracking), Quotes, Votes, Products, Orders (with Stripe integration), and Weekly Winners. The Hall of Fame dynamically ranks users based on wins and votes. The referral system uses cryptographically secure 8-character codes for discounts. Authentication is managed via Firebase Authentication for direct user sign-in (Google/Apple/Email) with backend token verification. The AuthRedirectHandler component globally handles OAuth redirects by waiting for Firebase auth state and invalidating queries. Profile completion flow: when new users lack first/last names, backend returns `{requiresProfile: true, email, profileImageUrl}` which triggers ProfileCompletionModal with prefilled data. Query invalidation after profile completion creates the account. A Twitter-style following system allows users to follow others, creating "friends" for mutual follows. The app is publicly viewable, with sign-in required only for interactive features.

### System Design Choices

The platform features a minimalist UI with a compact header for product visibility. Key features include:
- **iOS App Support**: Configured via Capacitor, enabling native iOS deployment. Info.plist requires NSCameraUsageDescription and NSPhotoLibraryUsageDescription for profile picture camera access.
- **Leaderboard**: Displays the weekly winning quote and current T-shirt for sale.
- **Profile Picture Upload**: Users can upload custom profile pictures via Firebase Storage with comprehensive error handling including 30-second upload timeout, 10-second URL fetch timeout, and specific Firebase error messages for better user feedback.
- **Weekly Winner Free Shirt**: Automated complimentary order for authors of winning quotes with exclusive gold text design. Winners receive a black shirt with gold lettering, while the store sells the same quote with white lettering. Two Printful products are created automatically: white text version (active, for sale) and gold text version (inactive, winner exclusive).
- **Admin Role System**: `isAdmin` field and middleware protect admin-only routes and provide a dashboard for analytics (revenue, orders, products). Admin manual trigger endpoint (`POST /api/admin/weekly-winner/trigger`) allows immediate winner selection for testing and emergency use.
- **Store Automation**: Automated weekly winner selection and Printful product creation via node-cron. Printful integration uses a self-hosted SVG design endpoint (`/api/designs/:quoteId/:textColor`) that Printful fetches directly from the production domain. Products are created with all size variants (S-2XL). Connection test runs on server startup to verify Printful API token validity.
- **Social Features**: Daily posting streaks, @mention parsing, and social media sharing (Twitter, Facebook, LinkedIn).
- **Hall of Fame**: Tracks top users based on weekly wins and total votes.
- **Referral System**: Unique referral codes provide 10% off for each earned referral, applied during checkout.
- **Public Viewing**: Allows unauthenticated users to browse content; sign-in is required for interactions.
- **Following System**: Replaced friend requests with a Twitter-style follow/unfollow system, impacting feed content.
- **Search People**: Users can search for other users by name from the Friends page. Search uses debounced input (300ms) and ILIKE matching on firstName, lastName, and username. Results show follow/unfollow buttons for authenticated users.
- **Quote Deletion**: Users can delete their own quotes with confirmation dialog. Weekly winners cannot be deleted to protect store products and history. Admins can delete any non-winner quote.
- **Quote Eligibility System**: Quotes remain on the ranking for 7 days from posting and are automatically removed if they win before the 7 days are up. All feeds (main, personalized, following, friends) only show eligible quotes that: 1) were posted within the last 7 days, and 2) have not already won a weekly competition. Winning quotes immediately move to the Archive.
- **Personalized Feed Algorithm**: The "Rate It" feed uses a smart personalization algorithm for authenticated users that scores quotes based on: author affinity (40% - learns from upvote history), recency (30% - exponential decay over 7 days), engagement sweet spot (20% - prioritizes 5-50 vote range), and diversity (10% - prevents author clustering). Anonymous users see chronological feed.
- **Support Page**: Dedicated /support route with contact form (mailto fallback) and comprehensive FAQ covering app usage, voting, referrals, and account deletion. Accessible via "Contact Support" button in profile settings.

## External Dependencies

- **Payment Processing**: Stripe for secure payments, client-side Elements, and server-side intent verification.
- **Print-on-Demand**: Printful API for automated product creation, order fulfillment, and QR code generation.
- **Authentication Service**: Firebase Authentication for user sign-in (Google, Apple, Email/Password). Apple Sign-In configured with Services ID (co.quoteit.service), App ID (co.quoteit.app), and OAuth private key for web authentication.
- **Database Provider**: Neon serverless PostgreSQL for data storage.
- **Cloud Storage**: Firebase Storage for profile picture uploads.
- **Scheduling**: node-cron for automated tasks (e.g., weekly winner selection).
- **Frontend Libraries**: React Hook Form (with Zod) for validation, date-fns for date formatting, Axios for HTTP requests, and QRCode for QR code generation.

## Deployment Configuration

- **Custom Domain**: quote-it.co (live and configured)
- **Apple Developer Account**: Active with App ID and Services ID configured for Sign In with Apple
- **Firebase Project**: quote-it-3a250 with authorized domains including quote-it.co
- **iOS Deployment**: Capacitor configured for native iOS app (requires Node.js installation for build)