import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

const env = (import.meta as any).env || {};
const appDomain = env.VITE_APP_DOMAIN || '';
const defaultAuthDomain = env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '';

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: typeof window !== 'undefined' && ((appDomain && window.location.hostname.includes(appDomain)) || window.location.hostname.includes('vercel.app'))
    ? window.location.hostname
    : defaultAuthDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || appletConfig.appId || '',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || appletConfig.measurementId || ''
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
    _storageInstance.maxUploadRetryTime = 5000;
    _storageInstance.maxOperationRetryTime = 5000;
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

