# Quote-It iOS App Setup Guide

Your Quote-It web app is now ready to be packaged as an iOS app! Here's everything you need to know to build and submit it to the App Store.

## ✅ What's Already Done

- ✅ Capacitor configured with bundle ID: `co.quoteit.app`
- ✅ iOS project generated in the `ios/` folder
- ✅ All plugins installed (@capacitor/app, splash-screen, status-bar)
- ✅ Web assets automatically synced to iOS project
- ✅ QR codes on T-shirts now point to quote-it.co

## 📋 Requirements

Before you can build and submit, you'll need:

1. **Mac computer** with macOS (required for Xcode)
2. **Xcode** installed (free from Mac App Store)
3. **Apple Developer Account** ($99/year) - [Sign up here](https://developer.apple.com/programs/)
4. **CocoaPods** installed (for iOS dependencies)

## 🔧 Initial Setup on Your Mac

### 1. Install CocoaPods
```bash
sudo gem install cocoapods
```

### 2. Clone/Download Your Replit Project
Download this entire project to your Mac.

### 3. Install Dependencies
```bash
npm install
cd ios/App
pod install
```

## 🔥 Configure Firebase for iOS

Firebase needs iOS-specific configuration:

### 1. Add iOS App in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your Quote-It project
3. Click "Add app" → Choose iOS
4. Enter Bundle ID: `co.quoteit.app`
5. Download the `GoogleService-Info.plist` file

### 2. Add GoogleService-Info.plist to Xcode
1. Open Xcode: `open ios/App/App.xcworkspace`
2. In Xcode, right-click on the "App" folder
3. Select "Add Files to App..."
4. Choose your downloaded `GoogleService-Info.plist`
5. Make sure "Copy items if needed" is checked
6. Click "Add"

## 🎨 Customize App Icons & Splash Screen

### App Icon
1. Open Xcode: `open ios/App/App.xcworkspace`
2. In the left sidebar, click on `Assets.xcassets`
3. Click on `AppIcon`
4. Drag your app icon images into the appropriate size slots
   - Recommended: Use a 1024x1024px PNG image
   - Xcode will auto-generate all sizes

### Splash Screen
The splash screen is currently black with your app name. To customize:
1. Open `Assets.xcassets` → `Splash`
2. Replace the splash images with your custom design
3. Or edit `capacitor.config.ts` to change splash screen settings

## 🏗️ Building Your App

### Step 1: Build Web Assets
From your project root:
```bash
npm run build
```

### Step 2: Sync to iOS
```bash
npx cap sync ios
```

### Step 3: Open in Xcode
```bash
npx cap open ios
```

### Step 4: Configure Signing
In Xcode:
1. Click on the project name in the left sidebar (top level)
2. Select the "Signing & Capabilities" tab
3. Check "Automatically manage signing"
4. Select your Team (your Apple Developer account)
5. Xcode will automatically create provisioning profiles

### Step 5: Build & Test
1. Select a simulator or your connected iPhone from the device dropdown
2. Click the Play button (▶️) to build and run
3. Test all features thoroughly

## 📱 Testing on a Real Device

1. Connect your iPhone via USB
2. In Xcode, select your iPhone from the device dropdown
3. Click the Play button
4. On your iPhone, go to Settings → General → VPN & Device Management
5. Trust your developer certificate
6. Open the app on your iPhone

## 🚀 Submitting to App Store

### 1. Prepare App Store Connect
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click "My Apps" → "+" → "New App"
3. Fill in:
   - Platform: iOS
   - Name: Quote-It
   - Bundle ID: co.quoteit.app
   - SKU: quoteit-app-001
   - User Access: Full Access

### 2. Create Archive
In Xcode:
1. Select "Any iOS Device (arm64)" from the device dropdown
2. Product → Archive
3. Wait for the build to complete (2-5 minutes)

### 3. Upload to App Store Connect
1. When archiving finishes, the Organizer window opens
2. Click "Distribute App"
3. Select "App Store Connect"
4. Click "Upload"
5. Follow the prompts

### 4. Submit for Review
1. Go back to App Store Connect
2. Fill in all required information:
   - App description
   - Screenshots (required for 6.7", 6.5", or 5.5" display)
   - Keywords
   - Support URL
   - Privacy Policy URL
3. Click "Submit for Review"

### 5. Wait for Approval
- Review typically takes 1-2 weeks
- You'll get email updates on the status
- If rejected, address the issues and resubmit

## 🔄 Updating Your App

When you make changes to your web app:

```bash
# 1. Build web assets
npm run build

# 2. Sync to iOS
npx cap sync ios

# 3. Open in Xcode
npx cap open ios

# 4. Increment version number in Xcode
# 5. Build & upload new version
```

## 📸 Screenshot Requirements

For App Store submission, you need screenshots of:
- 6.7" display (iPhone 14 Pro Max, 15 Pro Max): 1290 x 2796 pixels
- OR 6.5" display (iPhone 11 Pro Max, XS Max): 1242 x 2688 pixels  
- OR 5.5" display (iPhone 8 Plus): 1242 x 2208 pixels

Tip: Use the iOS Simulator in Xcode to capture these.

## ⚙️ Important Configuration

### Bundle ID
Your app bundle ID is: `co.quoteit.app`
- This must match across Firebase, Xcode, and App Store Connect
- Once published, this cannot be changed

### Version Numbers
Located in Xcode:
- Version: User-facing (e.g., "1.0.0")
- Build: Internal counter (e.g., "1", "2", "3")
- Increment Build number for each upload to App Store Connect

### Capabilities
Currently configured:
- Push Notifications (if needed in future)
- Sign in with Apple (via Firebase)

## 🐛 Common Issues

### "Provisioning profile doesn't include signing certificate"
- Solution: In Xcode, uncheck and recheck "Automatically manage signing"

### "Unable to install pod"
- Solution: Run `pod install --repo-update` in `ios/App/` directory

### "Module 'Firebase' not found"
- Solution: Make sure you added `GoogleService-Info.plist` to Xcode

### App crashes on launch
- Check Firebase configuration
- Check that all Firebase services match the iOS bundle ID

## 📚 Helpful Resources

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Firebase iOS Setup](https://firebase.google.com/docs/ios/setup)
- [TestFlight Beta Testing](https://developer.apple.com/testflight/)

## 💡 Next Steps

1. Install Xcode and CocoaPods on your Mac
2. Download `GoogleService-Info.plist` from Firebase Console
3. Open the project in Xcode
4. Add your app icon (1024x1024px recommended)
5. Test on simulator and real device
6. Create App Store Connect listing
7. Submit for review!

---

**Need help?** The Apple Developer documentation and forums are excellent resources. The review process can seem daunting, but once you've done it once, updates are much easier!
