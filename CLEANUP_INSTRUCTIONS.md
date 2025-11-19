# Database & Firebase Cleanup Instructions

## ✅ Development Database - COMPLETED
Your development database has been completely wiped clean:
- 15 users deleted
- 23 quotes deleted  
- 123 votes deleted
- 7 orders deleted
- 1 product deleted
- All other data cleared

**Your development environment is now ready!** When you sign up with your account, you'll automatically become the admin.

---

## 🔄 Production Database Cleanup (quote-it.co)

### Option 1: Using Replit Database GUI (Recommended)
1. Click on "Database" in the left sidebar
2. Switch to "Production" environment
3. Click on "SQL Editor" 
4. Copy and paste the SQL script below
5. Click "Run"

### Option 2: Using psql Command Line
If you have production database credentials, run these commands in order:

```sql
-- Delete all data in the correct order to respect foreign keys
DELETE FROM votes;
DELETE FROM follows;
DELETE FROM orders;
DELETE FROM weekly_winners;
DELETE FROM hall_of_fame;
DELETE FROM products;
DELETE FROM quotes;
DELETE FROM users;

-- Verify cleanup (should all return 0)
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_quotes FROM quotes;
SELECT COUNT(*) as total_orders FROM orders;
```

**⚠️ Important Notes:**
- This is **irreversible** - all user data will be permanently deleted
- Run this ONLY when you're ready to start fresh
- After cleanup, the first person to sign up on quote-it.co will become admin
- Consider backing up production data first if needed

---

## 🔥 Firebase User Deletion

Firebase Admin SDK can't bulk-delete users from the backend, so you need to do this through the Firebase Console:

### Step-by-Step Instructions:

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Select your project: "quote-it-3a250"

2. **Navigate to Authentication**
   - Click "Authentication" in the left sidebar
   - Click the "Users" tab

3. **Delete All Users**
   - Click the checkbox at the top to select all users
   - If you have more than 25 users, you'll need to delete in batches
   - Click the "..." menu (three dots) at the top right
   - Select "Delete account"
   - Confirm the deletion

4. **Verify Deletion**
   - Check that the user count shows "0 users"
   - This ensures all Firebase auth accounts are removed

**⏱️ Time Estimate:** 30-60 seconds for bulk deletion

**Note:** You may need to delete users from both:
- The default Firebase project (for web/development)
- Any separate iOS Firebase app (if configured differently)

---

## 🎯 After Cleanup - Creating Your Admin Account

1. **Make sure everything is cleaned up:**
   - ✅ Development database (done)
   - ✅ Production database (when ready)
   - ✅ Firebase users (when ready)

2. **Sign up on your website:**
   - Go to https://quote-it.co/login
   - Click "Sign Up"
   - Enter YOUR email and password
   - Complete your profile

3. **You're now the admin!**
   - Your account will automatically have admin privileges
   - You can access the admin dashboard at /admin
   - All future signups will be regular users

---

## 🚀 Publishing

After creating your admin account, remember to **publish** your app so the auto-admin feature is live on quote-it.co:

1. In Replit, click the "Publish" button
2. Wait for deployment to complete
3. Test by signing up on quote-it.co

---

## ❓ Questions?

**Q: What if I accidentally create a regular account first?**
A: You'll need to manually set `isAdmin = true` in the database for your account, or delete all users and start over.

**Q: Can I make multiple admin accounts?**
A: Yes, but you'll need to manually set `isAdmin = true` in the database for additional admins. Only the FIRST user gets auto-admin.

**Q: What happens to orders after user deletion?**
A: Orders are anonymized (shipping address removed) but kept for tax/legal compliance.
