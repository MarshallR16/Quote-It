# Fix Apple Sign-In for iOS and App Icons

## Problem 1: Apple Sign-In Opens Safari and Doesn't Return to App

**Root Cause**: Your iOS app uses web-based Firebase auth (`signInWithRedirect`) which opens Safari. The auth completes there, but the session never returns to your app.

**Solution**: Install native Firebase authentication plugin

### Step 1: Install the Plugin (Run in Replit Shell)

```bash
npm install --legacy-peer-deps @capacitor-firebase/authentication
```

The `--legacy-peer-deps` flag is required because the plugin expects Firebase 11, but you have Firebase 12.

### Step 2: Sync with iOS

```bash
npx cap sync ios
```

### Step 3: Update LoginPage.tsx

Replace the Apple and Google sign-in functions with this code:

```typescript
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const isNativeApp = Capacitor.isNativePlatform();

const handleAppleSignIn = async () => {
  setIsLoading(true);
  try {
    if (isNativeApp) {
      // Native iOS: Use plugin
      const result = await FirebaseAuthentication.signInWithApple();
      console.log('Signed in with Apple (native):', result.user);
      
      toast({
        title: "Welcome!",
        description: "You've successfully signed in",
      });
    } else {
      // Web: Use redirect flow
      await signInWithRedirect(auth, appleProvider);
    }
  } catch (error: any) {
    console.error("Error signing in:", error);
    toast({
      variant: "destructive",
      title: "Sign in failed",
      description: error.message,
    });
    setIsLoading(false);
  }
};

const handleGoogleSignIn = async () => {
  setIsLoading(true);
  try {
    if (isNativeApp) {
      // Native iOS: Use plugin
      const result = await FirebaseAuthentication.signInWithGoogle();
      console.log('Signed in with Google (native):', result.user);
      
      toast({
        title: "Welcome!",
        description: "You've successfully signed in",
      });
    } else {
      // Web: Use redirect flow
      await signInWithRedirect(auth, googleProvider);
    }
  } catch (error: any) {
    console.error("Error signing in:", error);
    toast({
      variant: "destructive",
      title: "Sign in failed",
      description: error.message,
    });
    setIsLoading(false);
  }
};
```

### Step 4: Configure Capacitor

Add to `capacitor.config.ts`:

```typescript
plugins: {
  FirebaseAuthentication: {
    skipNativeAuth: false,
    providers: ['google.com', 'apple.com']
  },
  // ... your existing plugins
}
```

### Step 5: iOS Setup (in Xcode)

1. Open `ios/App/App.xcworkspace` in Xcode
2. Go to `ios/App` folder in terminal
3. Run: `pod install`
4. Rebuild the app

**Result**: Apple/Google Sign-In will now stay in your app with a native sheet instead of opening Safari.

---

## Problem 2: iOS App Icons Not Showing

**Root Cause**: iOS caches app icons aggressively. Your icon files are all correct and properly configured.

**Solution**: Clear iOS cache

### All Icon Files Are Present ✓

```
ios/App/App/Assets.xcassets/AppIcon.appiconset/
├── icon-ios-1024x1024.png ✓
├── icon-ios-20x20@2x.png ✓
├── icon-ios-20x20@3x.png ✓
├── icon-ios-29x29@2x.png ✓
├── icon-ios-29x29@3x.png ✓
├── icon-ios-40x40@2x.png ✓
├── icon-ios-40x40@3x.png ✓
├── icon-ios-60x60@2x.png ✓
├── icon-ios-60x60@3x.png ✓
├── icon-ios-76x76@2x.png ✓
├── icon-ios-83.5x83.5@2x.png ✓
└── Contents.json ✓ (properly configured)
```

### Fix: Clear iOS Cache

**In Xcode:**

1. **Product → Clean Build Folder** (or press ⇧⌘K)
2. **Delete Derived Data:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/*
   ```
3. **Delete the app from your device/simulator completely**
4. **Rebuild and run**

**Alternative: Reset Simulator**

If using iOS Simulator:
1. Device → Erase All Content and Settings
2. Rebuild and run

**On Physical Device:**

1. Delete Quote-It app completely
2. Clean build in Xcode
3. Rebuild and install

The icons will appear after this cache clear!

---

## Summary

1. **Apple Sign-In**: Install plugin with `npm install --legacy-peer-deps @capacitor-firebase/authentication` and update LoginPage
2. **Icons**: Clear iOS cache by deleting derived data and app

Both fixes require rebuilding the iOS app after making changes.
