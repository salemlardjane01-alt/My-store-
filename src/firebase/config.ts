import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || '',
  authDomain: typeof window !== 'undefined' && (window.location.hostname.includes((import.meta as any).env?.VITE_APP_DOMAIN || '') || window.location.hostname.includes('vercel.app'))
    ? window.location.hostname
    : ((import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || ''),
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || ''
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
    experimentalForceLongPolling: true,
  });
} catch (e) {
  console.warn("Firestore persistent local cache initialization failed, falling back to long-polling without persistent multiple tab manager.", e);
  try {
    dbInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  } catch (err) {
    console.error("Firestore initialization failed completely.", err);
    // Fallback to basic getFirestore
    dbInstance = getFirestore(app);
  }
}

const db = dbInstance;

let _storageInstance: ReturnType<typeof getStorage> | null = null;
export const getStorageInstance = () => {
  if (!_storageInstance) {
    _storageInstance = getStorage(app);
  }
  return _storageInstance;
};
export { db, auth };
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const SETTINGS_COLLECTION = 'settings';
export const ORDERS_COLLECTION = 'orders';

