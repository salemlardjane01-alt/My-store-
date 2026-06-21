import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  runTransaction,
  writeBatch,
  where,
  limit
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { saveToLocalCache, getFromLocalCache, invalidateCache } from './lib/cacheHelper';
import { db, auth, storage, googleProvider, handleFirestoreError, OperationType, SETTINGS_COLLECTION, ORDERS_COLLECTION } from './firebase/config';
import { 
  getUserProfileDocument, 
  createUserProfileDocument, 
  signInWithGoogle, 
  logOut, 
  USERS_COLLECTION,
  getUsers
} from './firebase/auth';

export type { FirestoreErrorInfo } from './firebase/config';
export { db, auth, storage, googleProvider, handleFirestoreError, OperationType, SETTINGS_COLLECTION, ORDERS_COLLECTION };
export { 
  getUserProfileDocument, 
  createUserProfileDocument, 
  signInWithGoogle, 
  logOut, 
  USERS_COLLECTION,
  getUsers
};

import { 
  getCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory 
} from './firebase/categories';

export { 
  getCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory 
};

import { 
  COLORS_COLLECTION,
  getColors, 
  addColorDoc, 
  updateColorDoc, 
  deleteColorDoc 
} from './firebase/colors';

export {
  COLORS_COLLECTION,
  getColors, 
  addColorDoc, 
  updateColorDoc, 
  deleteColorDoc 
};

import { 
  PRODUCTS_COLLECTION,
  invalidateProductsCache,
  getProducts, 
  getProductsWithLimit, 
  getProductById, 
  addProduct, 
  updateProduct, 
  deleteProduct,
  uploadProductImage,
  deleteProductImageByUrl,
  uploadImage
} from './firebase/products';

export {
  PRODUCTS_COLLECTION,
  invalidateProductsCache,
  getProducts, 
  getProductsWithLimit, 
  getProductById, 
  addProduct, 
  updateProduct, 
  deleteProduct,
  uploadProductImage,
  deleteProductImageByUrl
};

import { 
  TELEGRAM_DOCUMENT_ID,
  getTelegramSettings, 
  updateTelegramSettings, 
  sendTelegramMessage, 
  sendTelegramNotificationIfNeeded 
} from './firebase/telegram';

export {
  TELEGRAM_DOCUMENT_ID,
  getTelegramSettings, 
  updateTelegramSettings, 
  sendTelegramMessage, 
  sendTelegramNotificationIfNeeded 
};

import {
  HERO_DOCUMENT_ID,
  SOCIAL_DOCUMENT_ID,
  DELIVERY_PROVIDERS_DOCUMENT_ID,
  getHeroSettings,
  updateHeroSettings,
  uploadHeroImage,
  getSocialSettings,
  updateSocialSettings,
  getDeliveryProvidersSettings,
  updateDeliveryProvidersSettings
} from './firebase/settings';

export {
  HERO_DOCUMENT_ID,
  SOCIAL_DOCUMENT_ID,
  DELIVERY_PROVIDERS_DOCUMENT_ID,
  getHeroSettings,
  updateHeroSettings,
  uploadHeroImage,
  getSocialSettings,
  updateSocialSettings,
  getDeliveryProvidersSettings,
  updateDeliveryProvidersSettings
};

import {
  SHIPPING_RATES_COLLECTION,
  getShippingRates,
  updateShippingRate
} from './firebase/shipping';

export {
  SHIPPING_RATES_COLLECTION,
  getShippingRates,
  updateShippingRate
};

// ==========================================
// Auth API
// ==========================================

// Performance Cache variables

// ==========================================
// Orders & Pre-aggregated Analytics API
// ==========================================
import {
  getAlgiersDateComponents,
  getAlgiersWeekString,
  applyAnalyticsDeltaInMemory,
  updateAnalyticsForOrder,
  emergencyRecalculateAnalytics,
  ensureAnalyticsSeeded
} from './firebase/analytics';

export {
  getAlgiersDateComponents,
  getAlgiersWeekString,
  applyAnalyticsDeltaInMemory,
  updateAnalyticsForOrder,
  emergencyRecalculateAnalytics,
  ensureAnalyticsSeeded
};

import {
  createOrder,
  getOrders,
  getOrderByNumberOrId,
  updateOrder,
  deleteOrder
} from './firebase/orders';

export {
  createOrder,
  getOrders,
  getOrderByNumberOrId,
  updateOrder,
  deleteOrder
};
