import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'co.quoteit.app',
  appName: 'Quote-It',
  webDir: 'dist/public',
  // Commented out to use local files for testing safe area fixes
  // Uncomment to load from live site: https://quote-it.co
  // server: {
  //   url: 'https://quote-it.co',
  //   androidScheme: 'https',
  //   iosScheme: 'https',
  //   cleartext: true,
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
};

export default config;
