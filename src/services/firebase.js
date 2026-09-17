import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAiLBF4kYu30S3DJZClvwVXMkmm9QqCBms",
  authDomain: "marytex-11a64.firebaseapp.com",
  projectId: "marytex-11a64",
  storageBucket: "marytex-11a64.firebasestorage.app",
  messagingSenderId: "761952932612",
  appId: "1:761952932612:web:7e2e2357309b576f31f651",
  measurementId: "G-0BHCVXN5XQ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);