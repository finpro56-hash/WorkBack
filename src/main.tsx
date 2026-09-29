import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppProvider } from './context/AppContext.tsx';
import './index.css';

// Automatically register the PWA service worker (crucial for mobile installation)
import { registerSW } from 'virtual:pwa-register';

if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('New content available, please refresh.');
    },
    onOfflineReady() {
      console.log('WorkBack is offline ready!');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <App />
  </AppProvider>
);
