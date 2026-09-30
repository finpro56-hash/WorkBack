import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

// Provider setup with required Google Workspace Scopes
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory access token storage initialized from localStorage for seamless persistence
let cachedAccessToken: string | null = localStorage.getItem('wb_access_token');

export const isTokenExpired = (): boolean => {
  const token = localStorage.getItem('wb_access_token');
  const timestampStr = localStorage.getItem('wb_token_timestamp');
  if (!token) return true;
  if (!timestampStr) return false; // If not recorded, assume present

  const timestamp = parseInt(timestampStr, 10);
  // Google OAuth tokens expire in 60 minutes. Flag as expired after 55 minutes.
  const isExpired = Date.now() - timestamp > 55 * 60 * 1000;
  return isExpired;
};

/**
 * Initialize Auth state listener.
 * Restores Google Workspace access token from localStorage for seamless user session retention.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (!cachedAccessToken) {
      cachedAccessToken = localStorage.getItem('wb_access_token');
    }

    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Trigger Google Sign-In via popup and cache token in localStorage to retain session across reloads
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Sign-In.');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('wb_access_token', credential.accessToken);
    localStorage.setItem('wb_token_timestamp', Date.now().toString());
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
};

/**
 * Retrieve cached access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem('wb_access_token');
  }
  return cachedAccessToken;
};

/**
 * Manually inject a cached token
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('wb_access_token', token);
    localStorage.setItem('wb_token_timestamp', Date.now().toString());
  } else {
    localStorage.removeItem('wb_access_token');
    localStorage.removeItem('wb_token_timestamp');
  }
};

/**
 * Sign out, clear cached token, and clear persistent session
 */
export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('wb_access_token');
  localStorage.removeItem('wb_token_timestamp');
};
