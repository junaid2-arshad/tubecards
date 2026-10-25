// Paste your Firebase web-app config here (Firebase console > Project settings > Your apps > Web app).
// These values identify your project; they are not secrets. Your data is protected by
// the sign-in requirement and the rules in firestore.rules, not by hiding this file.
//
// Leave apiKey empty to run in local demo mode: no login, data stays on this device only.

export const firebaseConfig = {
  apiKey: "AIzaSyAd2RCevI5ylSJTl9w0S70XwRhEl-m8nrY",
  authDomain: "tubecards.firebaseapp.com",
  projectId: "tubecards",
  storageBucket: "tubecards.firebasestorage.app",
  messagingSenderId: "99832391526",
  appId: "1:99832391526:web:db57ab4adf5d8abe8ccaa7"
};

// The Firebase SDK is loaded from Google's CDN at this version and then cached by the
// service worker, so the app keeps working offline after the first visit.
export const FIREBASE_SDK_VERSION = '10.12.2';

export const firebaseEnabled = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
