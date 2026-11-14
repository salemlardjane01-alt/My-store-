import { db, auth, getStorageInstance, googleProvider, handleFirestoreError, OperationType, SETTINGS_COLLECTION, ORDERS_COLLECTION } from './firebase/config';
import { 
  getUserProfileDocument, 
  createUserProfileDocument, 
  signInWithGoogle, 
  logOut, 
  USERS_COLLECTION,
  getUsers,
  checkIsAdmin
} from './firebase/auth';

export type { FirestoreErrorInfo } from './firebase/config';
export { db, auth, getStorageInstance, googleProvider, handleFirestoreError, OperationType, SETTINGS_COLLECTION, ORDERS_COLLECTION };
export { 
  getUserProfileDocument, 
  createUserProfileDocument, 
  signInWithGoogle, 
  logOut, 
  USERS_COLLECTION,
  getUsers,
  checkIsAdmin
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
  uploadProductImageDetailed,
  estimateDocumentBytes,
  deleteProductImageByUrl
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
  uploadProductImageDetailed,
  estimateDocumentBytes,
  deleteProductImageByUrl
};

import { 
  TELEGRAM_DOCUMENT_ID,
  getTelegramSettings, 
  updateTelegramSettings, 
  sendTelegramMessage, 
  sendTelegramMessageDetailed,
  sanitizeBotToken,
  sanitizeChatId,
  escapeTelegramHtml,
  sendTelegramNotificationIfNeeded 
} from './firebase/telegram';

export {
  TELEGRAM_DOCUMENT_ID,
  getTelegramSettings, 
  updateTelegramSettings, 
  sendTelegramMessage, 
  sendTelegramMessageDetailed,
  sanitizeBotToken,
  sanitizeChatId,
  escapeTelegramHtml,
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
  applyAnalyticsDeltaInMemory,
  emergencyRecalculateAnalytics,
  ensureAnalyticsSeeded
} from './firebase/analytics';

export {
  getAlgiersDateComponents,
  applyAnalyticsDeltaInMemory,
  emergencyRecalculateAnalytics,
  ensureAnalyticsSeeded
};

import {
  createOrder,
  getOrders,
  updateOrder,
  deleteOrder
} from './firebase/orders';

export {
  createOrder,
  getOrders,
  updateOrder,
  deleteOrder
};
