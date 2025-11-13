import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

// Initialize StatusBar for native platforms
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(err => {
    console.warn('StatusBar setOverlaysWebView failed:', err);
  });
  
  StatusBar.setStyle({ style: Style.Dark }).catch(err => {
    console.warn('StatusBar setStyle failed:', err);
  });
  
  StatusBar.setBackgroundColor({ color: '#000000' }).catch(err => {
    console.warn('StatusBar setBackgroundColor failed:', err);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
