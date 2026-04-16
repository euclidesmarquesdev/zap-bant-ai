import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const isValidConfig = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "TODO_KEYHERE";

const app = isValidConfig 
  ? (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp())
  : null;

export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null as any;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// O e-mail abaixo terá poderes de Administrador Principal no sistema
export const adminEmail = (firebaseConfig as any).adminEmail || "";

export { isValidConfig };
