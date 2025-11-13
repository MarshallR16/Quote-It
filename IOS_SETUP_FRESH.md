# Fresh iOS Setup Guide

## What's Ready

Your iOS project has been completely regenerated with:
- ✅ Server connected to quote-it.co
- ✅ Network permissions configured
- ✅ Apple Sign-In ready (App ID: co.quoteit.app)
- ✅ All Capacitor plugins installed

## Download & Setup (5 Minutes!)

### Step 1: Download the Project

1. Click the **three dots (⋮)** at the top of Replit
2. Select **Download as zip**
3. Save it to your **Downloads** folder
4. **Double-click** the zip file to unzip it

### Step 2: Move to Safe Location

**IMPORTANT:** Don't keep it in Downloads or Desktop!

1. Open **Finder**
2. Click **Go** menu → **Home** (or press Shift + Command + H)
3. Create a new folder called **"Projects"**
4. **Drag the unzipped Quote-It folder** into Projects

### Step 3: Install Dependencies

1. Open **Terminal**
2. Type these commands:

```bash
cd ~/Projects/Quote-It
npm install
cd ios/App
pod install
```

This installs all the iOS libraries (takes 2-3 minutes).

### Step 4: Open in Xcode

1. When pod install finishes, open **Finder**
2. Go to **Home** → **Projects** → **Quote-It** → **ios** → **App**
3. **Double-click** **App.xcworkspace** (the blue icon)

### Step 5: Add GoogleService-Info.plist

1. Download the file from Firebase Console (or find your copy)
2. In Xcode, **right-click** on the **"App" folder** (left sidebar)
3. Select **"Add Files to App"**
4. Choose **GoogleService-Info.plist**
5. Make sure **"Copy items if needed"** is checked
6. Click **Add**

### Step 6: Build & Run

1. At the top left of Xcode, make sure it shows **"App"** and **"iPhone 16"** (or similar)
2. Click the **Play button ▶️**
3. The app will build and launch in the simulator!

## If You See Security Errors

If you get "Operation not permitted" errors:

1. Go to **System Settings** → **Privacy & Security** → **Full Disk Access**
2. Click the **lock** icon (bottom left) and enter your password
3. Click **+** button
4. Add **Xcode** from Applications
5. Make sure the toggle is **ON**
6. **Restart Xcode** and try again

## What Should Happen

The app should:
- Launch in the iPhone simulator
- Connect to quote-it.co
- Show your Quote-It app with all your quotes and features!

## Need Help?

Just let me know what error message you see and I'll help you fix it!
