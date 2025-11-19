# Demo Accounts Setup for Apple Review

## Credentials

Create these 3 accounts using the normal signup flow at `/login`:

### Account 1
- **Email**: demo1@quote-it.co
- **Password**: Demo2025!
- **Name**: Alex Rivera

### Account 2
- **Email**: demo2@quote-it.co
- **Password**: Demo2025!
- **Name**: Jordan Chen

### Account 3
- **Email**: demo3@quote-it.co
- **Password**: Demo2025!
- **Name**: Sam Taylor

## Setup Steps

1. **Create the accounts**: 
   - Go to `/login` and click "Sign Up"
   - For each account above, fill in:
     - Name (e.g., "Alex Rivera")
     - Email (e.g., "demo1@quote-it.co")
     - Password ("Demo2025!")
     - Accept Terms of Service
   - Click "Sign Up"

2. **Add sample content**:
   - Run the demo content script: `tsx server/addDemoContent.ts`
   - This will add quotes, votes, and follows to make the app look active

3. **Test the accounts**:
   - Log in to each account
   - Verify they can see quotes
   - Check that following relationships work
   - Ensure voting works properly

## Features Demonstrated

The demo accounts will showcase:
- ✅ Quote posting and viewing
- ✅ Upvoting system
- ✅ Follow relationships
- ✅ @mention functionality  
- ✅ Posting streaks
- ✅ Personalized feed algorithm
- ✅ Profile pictures (optional - can be added later)

## For Apple Reviewers

These test accounts allow Apple reviewers to:
- Experience the full user journey
- Test social interactions (following, voting)
- See an active community with existing content
- Verify all core features work correctly

**Note**: No admin access is provided to demo accounts. Admin features are reserved for the app owner.
