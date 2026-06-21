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
import { db, auth, storage, googleProvider, handleFirestoreError, OperationType, SETTINGS_COLLECTION } from './firebase/config';
import { 
  getUserProfileDocument, 
  createUserProfileDocument, 
  signInWithGoogle, 
  logOut, 
  USERS_COLLECTION 
} from './firebase/auth';

export type { FirestoreErrorInfo } from './firebase/config';
export { db, auth, storage, googleProvider, handleFirestoreError, OperationType, SETTINGS_COLLECTION };
export { 
  getUserProfileDocument, 
  createUserProfileDocument, 
  signInWithGoogle, 
  logOut, 
  USERS_COLLECTION 
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
const ORDERS_COLLECTION = 'orders';

// Algiers timezone helper models and operations (GMT+1)
export const getAlgiersDateComponents = (date: Date) => {
  try {
    const options = { timeZone: 'Africa/Algiers', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || String(date.getFullYear());
    const month = parts.find(p => p.type === 'month')?.value || String(date.getMonth() + 1).padStart(2, '0');
    const day = parts.find(p => p.type === 'day')?.value || String(date.getDate()).padStart(2, '0');
    return { year, month, day, dateStr: `${year}-${month}-${day}` };
  } catch (e) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return { year, month, day, dateStr: `${year}-${month}-${day}` };
  }
};

export const getAlgiersWeekString = (date: Date): string => {
  const { year, month, day } = getAlgiersDateComponents(date);
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const isPendingOrProcessing = (status: string) => {
  return status === 'pending' || status === 'processing';
};

export const applyAnalyticsDeltaInMemory = (analytics: any, orderData: any, coefficient: number = 1) => {
  if (!orderData) return;
  
  const status = orderData.status || 'pending';
  const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    console.warn(`[Analytics Guard] Ignored order with unknown status: ${status}`);
    return;
  }

  // Define globalStats structure cleanly
  if (!analytics.globalStats) {
    analytics.globalStats = {
      cancelledOrdersCount: 0,
      processingOrdersCount: 0,
      cancellationRate: 0
    };
  }

  // Update global counters
  if (status === 'cancelled') {
    if (analytics.globalStats.cancelledOrdersCount === undefined) analytics.globalStats.cancelledOrdersCount = 0;
    analytics.globalStats.cancelledOrdersCount += coefficient;
    if (analytics.globalStats.cancelledOrdersCount < 0) analytics.globalStats.cancelledOrdersCount = 0;
  } else if (status === 'processing') {
    if (analytics.globalStats.processingOrdersCount === undefined) analytics.globalStats.processingOrdersCount = 0;
    analytics.globalStats.processingOrdersCount += coefficient;
    if (analytics.globalStats.processingOrdersCount < 0) analytics.globalStats.processingOrdersCount = 0;
  }

  // Recalculate cancellationRate dynamically: (Cancelled ÷ Processing) * 100
  const cancelledCount = Number(analytics.globalStats.cancelledOrdersCount) || 0;
  const processingCount = Number(analytics.globalStats.processingOrdersCount) || 0;
  analytics.globalStats.cancellationRate = processingCount > 0 ? (cancelledCount / processingCount) * 100 : 0;

  // Extract date correctly
  let dateObj = new Date();
  if (orderData.createdAt) {
    if (typeof orderData.createdAt.toDate === 'function') {
      dateObj = orderData.createdAt.toDate();
    } else if (orderData.createdAt.seconds) {
      dateObj = new Date(orderData.createdAt.seconds * 1000);
    } else {
      dateObj = new Date(orderData.createdAt);
    }
  }
  
  const { dateStr } = getAlgiersDateComponents(dateObj);

  if (!analytics.dailyStats) {
    analytics.dailyStats = {};
  }

  if (!analytics.dailyStats[dateStr]) {
    analytics.dailyStats[dateStr] = {
      pendingCount: 0,
      processingCount: 0,
      shippedCount: 0,
      deliveredCount: 0,
      cancelledCount: 0,
      wilayaCounts: {}
    };
  }

  const daily = analytics.dailyStats[dateStr];
  if (daily.pendingCount === undefined) daily.pendingCount = 0;
  if (daily.processingCount === undefined) daily.processingCount = 0;
  if (daily.shippedCount === undefined) daily.shippedCount = 0;
  if (daily.deliveredCount === undefined) daily.deliveredCount = 0;
  if (daily.cancelledCount === undefined) daily.cancelledCount = 0;
  if (daily.wilayaCounts === undefined) daily.wilayaCounts = {};

  // Increment specific status counters today
  if (status === 'pending') {
    daily.pendingCount += coefficient;
    if (daily.pendingCount < 0) daily.pendingCount = 0;
  } else if (status === 'processing') {
    daily.processingCount += coefficient;
    if (daily.processingCount < 0) daily.processingCount = 0;
  } else if (status === 'shipped') {
    daily.shippedCount += coefficient;
    if (daily.shippedCount < 0) daily.shippedCount = 0;
  } else if (status === 'delivered') {
    daily.deliveredCount += coefficient;
    if (daily.deliveredCount < 0) daily.deliveredCount = 0;
  } else if (status === 'cancelled') {
    daily.cancelledCount += coefficient;
    if (daily.cancelledCount < 0) daily.cancelledCount = 0;
  }

  // Top Wilaya is calculated from non-cancelled orders only
  const wilayaName = orderData.customerInfo?.state?.trim();
  if (wilayaName && status !== 'cancelled') {
    if (!daily.wilayaCounts[wilayaName]) {
      daily.wilayaCounts[wilayaName] = 0;
    }
    daily.wilayaCounts[wilayaName] += coefficient;
    if (daily.wilayaCounts[wilayaName] <= 0) {
      delete daily.wilayaCounts[wilayaName];
    }
  }

  // Audit log entry for diagnostics and real-time validation (simplified)
  const logEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    orderId: orderData.id || orderData.orderNumber || 'new_order',
    status: status,
    coefficient: coefficient,
    type: coefficient > 0 ? 'ADD' : 'SUBTRACT',
    timestamp: new Date().toISOString()
  };

  if (!analytics.logs) analytics.logs = [];
  analytics.logs.unshift(logEntry);
  if (analytics.logs.length > 25) {
    analytics.logs = analytics.logs.slice(0, 25);
  }
};

export const updateAnalyticsForOrder = async (transaction: any, orderData: any, coefficient: number = 1) => {
  // Input integrity guard - reject orders that contain missing, corrupt, or invalid critical fields
  if (!orderData) return;
  
  const status = orderData.status || 'pending';
  const totalPrice = Number(orderData.totalPrice);
  
  // Validation checks:
  if (isNaN(totalPrice) || totalPrice < 0) {
    console.warn(`[Analytics Guard] Ignored order with invalid price: ${orderData.totalPrice}`);
    return;
  }
  const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    console.warn(`[Analytics Guard] Ignored order with unknown status: ${status}`);
    return;
  }
  if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
    console.warn(`[Analytics Guard] Ignored order with missing or empty items`);
    return;
  }

  const analyticsRef = doc(db, 'analytics', 'dashboard');
  const analyticsSnap = await transaction.get(analyticsRef);
  
  let analytics: any = {
    initialized: true,
    globalStats: { 
      totalSales: 0, 
      ordersCount: 0, 
      averageOrderValue: 0, 
      pendingRevenue: 0, 
      pendingOrdersCount: 0,
      grossSales: 0,
      shippedRevenue: 0,
      deliveredRevenue: 0,
      productRevenue: 0,
      shippingRevenue: 0,
      grossRevenue: 0,
      netProfit: 0,
      cancelledOrdersCount: 0,
      cancelledRevenueLost: 0,
      cancellationRate: 0
    },
    dailyStats: {},
    weeklyStats: {},
    wilayaStats: {},
    productStats: {},
    logs: [] // High-visibility diagnostic debug audit logs inside the doc
  };
  
  if (analyticsSnap.exists()) {
    const existingData = analyticsSnap.data();
    analytics = {
      initialized: existingData.initialized !== undefined ? existingData.initialized : true,
      globalStats: {
        totalSales: Number(existingData.globalStats?.totalSales) || 0,
        ordersCount: Number(existingData.globalStats?.ordersCount) || 0,
        averageOrderValue: Number(existingData.globalStats?.averageOrderValue) || 0,
        pendingRevenue: Number(existingData.globalStats?.pendingRevenue) || 0,
        pendingOrdersCount: Number(existingData.globalStats?.pendingOrdersCount) || 0,
        grossSales: Number(existingData.globalStats?.grossSales) ?? Number(existingData.globalStats?.totalSales) ?? 0,
        shippedRevenue: Number(existingData.globalStats?.shippedRevenue) || 0,
        deliveredRevenue: Number(existingData.globalStats?.deliveredRevenue) || 0,
        productRevenue: Number(existingData.globalStats?.productRevenue) ?? Number(existingData.globalStats?.totalSales) ?? 0,
        shippingRevenue: Number(existingData.globalStats?.shippingRevenue) || 0,
        grossRevenue: Number(existingData.globalStats?.grossRevenue) ?? Number(existingData.globalStats?.totalSales) ?? 0,
        netProfit: Number(existingData.globalStats?.netProfit) ?? Number(existingData.globalStats?.totalSales) ?? 0,
        cancelledOrdersCount: Number(existingData.globalStats?.cancelledOrdersCount) || 0,
        cancelledRevenueLost: Number(existingData.globalStats?.cancelledRevenueLost) || 0,
        cancellationRate: Number(existingData.globalStats?.cancellationRate) || 0
      },
      dailyStats: existingData.dailyStats || {},
      weeklyStats: existingData.weeklyStats || {},
      wilayaStats: existingData.wilayaStats || {},
      productStats: existingData.productStats || {},
      logs: existingData.logs || []
    };
  }

  applyAnalyticsDeltaInMemory(analytics, orderData, coefficient);

  transaction.set(analyticsRef, analytics);
};

export const emergencyRecalculateAnalytics = async () => {
  try {
    console.log("Emergency Recalculating Core Analytics started...");
    const ordersCol = collection(db, ORDERS_COLLECTION);
    const ordersSnap = await getDocs(ordersCol);
    
    const analytics: any = {
      initialized: true,
      globalStats: { 
        cancelledOrdersCount: 0,
        processingOrdersCount: 0,
        cancellationRate: 0
      },
      dailyStats: {},
      logs: [{
        id: `recalc-${Date.now()}`,
        orderId: 'all_reconciled',
        status: 'recalculated_from_scratch',
        coefficient: 1,
        type: 'RECONCILED',
        timestamp: new Date().toISOString()
      }]
    };

    const batch = writeBatch(db);
    let dirtyCount = 0;

    ordersSnap.docs.forEach((snapDoc) => {
      const orderRef = snapDoc.ref;
      const orderData = snapDoc.data();
      const status = orderData.status || 'pending';
      
      const allowedStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!allowedStatuses.includes(status)) return;

      // Keep tracking applied status for idempotency logic
      if (orderData.analyticsAppliedStatus !== status) {
        batch.update(orderRef, { analyticsAppliedStatus: status });
        dirtyCount++;
      }

      applyAnalyticsDeltaInMemory(analytics, orderData, 1);
    });

    const analyticsRef = doc(db, 'analytics', 'dashboard');
    batch.set(analyticsRef, analytics);
    
    await batch.commit();
    console.log(`Successfully completed reconciliation recalculation! Synced ${dirtyCount} orders.`);
    return analytics;
  } catch (error) {
    console.error("Failed to run emergency recalculation: ", error);
    throw error;
  }
};

export const ensureAnalyticsSeeded = async () => {
  try {
    const analyticsRef = doc(db, 'analytics', 'dashboard');
    const analyticsSnap = await getDoc(analyticsRef);
    
    if (analyticsSnap.exists()) {
      const data = analyticsSnap.data();
      if (data && data.initialized === true) {
        return data;
      }
    }
    
    return await emergencyRecalculateAnalytics();
  } catch (err) {
    console.error("Failed to enforce analytics seed check:", err);
    return {
      globalStats: { 
        cancelledOrdersCount: 0,
        processingOrdersCount: 0,
        cancellationRate: 0
      },
      dailyStats: {}
    };
  }
};

export const createOrder = async (orderData: any) => {
  try {
    const result = await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, 'settings', 'counters');
      const analyticsRef = doc(db, 'analytics', 'dashboard');
      const settingsRef = doc(db, 'settings', 'telegram');
      
      // 1. Perform ALL reads first!
      const counterSnap = await transaction.get(counterRef);
      const analyticsSnap = await transaction.get(analyticsRef);
      const settingsSnap = await transaction.get(settingsRef);
      
      let nextNum = 1001;
      if (counterSnap.exists()) {
        const data = counterSnap.data();
        if (data && typeof data.lastOrderNumber === 'number') {
          nextNum = data.lastOrderNumber + 1;
        }
      }
      
      const orderNumber = `#ORD-${nextNum}`;
      const orderRef = doc(collection(db, ORDERS_COLLECTION));
      const status = orderData.status || 'pending';

      let assignedBotId = '';
      let nextBotIndex = 0;
      let hasMultipleBots = false;

      if (settingsSnap.exists()) {
        const settingsData = settingsSnap.data();
        if (settingsData && settingsData.enabled) {
          const bots = settingsData.bots || [];
          if (bots.length > 0) {
            hasMultipleBots = true;
            const lastIndex = typeof settingsData.lastUsedBotIndex === 'number' ? settingsData.lastUsedBotIndex : -1;
            nextBotIndex = (lastIndex + 1) % bots.length;
            const selectedBot = bots[nextBotIndex];
            assignedBotId = selectedBot.id;
          } else if (settingsData.botToken && settingsData.chatId) {
            assignedBotId = 'primary';
          }
        }
      }

      const enrichedOrderData = {
        ...orderData,
        status,
        orderNumber,
        analyticsAppliedStatus: status, // Set actual applied state directly to prevent double computing
        createdAt: serverTimestamp(),
        ...(assignedBotId ? { assignedBotId } : {})
      };

      // Initialize analytics in-memory
      let analytics: any = {
        initialized: true,
        globalStats: { 
          cancelledOrdersCount: 0,
          processingOrdersCount: 0,
          cancellationRate: 0
        },
        dailyStats: {},
        logs: []
      };
      
      if (analyticsSnap.exists()) {
        const existingData = analyticsSnap.data();
        analytics = {
          initialized: existingData.initialized !== undefined ? existingData.initialized : true,
          globalStats: {
            cancelledOrdersCount: Number(existingData.globalStats?.cancelledOrdersCount) || 0,
            processingOrdersCount: Number(existingData.globalStats?.processingOrdersCount) || 0,
            cancellationRate: Number(existingData.globalStats?.cancellationRate) || 0
          },
          dailyStats: existingData.dailyStats || {},
          logs: existingData.logs || []
        };
      }

      // Compute in-memory update
      applyAnalyticsDeltaInMemory(analytics, { ...enrichedOrderData, createdAt: new Date() }, 1);
      
      // 2. Perform ALL writes afterwards
      transaction.set(orderRef, enrichedOrderData);
      transaction.set(counterRef, { lastOrderNumber: nextNum }, { merge: true });
      transaction.set(analyticsRef, analytics);
      if (hasMultipleBots) {
        transaction.update(settingsRef, {
          lastUsedBotIndex: nextBotIndex
        });
      }
      
      return { id: orderRef.id, orderNumber, enrichedOrderData };
    });

    // Send Telegram Notification if configured/enabled
    try {
      await sendTelegramNotificationIfNeeded(result.id, result.enrichedOrderData);
    } catch (telegramErr) {
      console.error("Error triggering Telegram notification:", telegramErr);
    }

    return result.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ORDERS_COLLECTION);
  }
};

export const getOrders = async () => {
  try {
    const q = query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ORDERS_COLLECTION);
  }
};

export const getOrderByNumberOrId = async (searchIdent: string) => {
  try {
    const cleanSearch = searchIdent.trim();
    if (!cleanSearch) return null;
    
    // First, try querying by orderNumber field
    const q1 = query(collection(db, ORDERS_COLLECTION), where('orderNumber', '==', cleanSearch));
    const snapshot1 = await getDocs(q1);
    if (!snapshot1.empty) {
      const doc = snapshot1.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    
    // Support without # prefix, e.g. "ORD-123" if they typed "ORD-123"
    if (!cleanSearch.startsWith('#')) {
      const q2 = query(collection(db, ORDERS_COLLECTION), where('orderNumber', '==', `#${cleanSearch}`));
      const snapshot2 = await getDocs(q2);
      if (!snapshot2.empty) {
        const doc = snapshot2.docs[0];
        return { id: doc.id, ...doc.data() };
      }
    }
    
    // Also try doc ID fallback
    try {
      const docRef = doc(db, ORDERS_COLLECTION, cleanSearch);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
    } catch (e) {
      // ignore check
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching order by number/id:", error);
    return null;
  }
};

export const updateOrder = async (id: string, orderData: any) => {
  try {
    await runTransaction(db, async (transaction) => {
      const docRef = doc(db, ORDERS_COLLECTION, id);
      const analyticsRef = doc(db, 'analytics', 'dashboard');
      
      // 1. Perform ALL reads first!
      const orderSnap = await transaction.get(docRef);
      const analyticsSnap = await transaction.get(analyticsRef);
      
      if (!orderSnap.exists()) {
        throw new Error("Order not found");
      }
      
      const existingOrder = orderSnap.data();
      const oldStatus = existingOrder.analyticsAppliedStatus || existingOrder.status || 'pending';
      const newStatus = orderData.status;

      // Initialize analytics in-memory
      let analytics: any = {
        initialized: true,
        globalStats: { 
          cancelledOrdersCount: 0,
          processingOrdersCount: 0,
          cancellationRate: 0
        },
        dailyStats: {},
        logs: []
      };
      
      if (analyticsSnap.exists()) {
        const existingData = analyticsSnap.data();
        analytics = {
          initialized: existingData.initialized !== undefined ? existingData.initialized : true,
          globalStats: {
            cancelledOrdersCount: Number(existingData.globalStats?.cancelledOrdersCount) || 0,
            processingOrdersCount: Number(existingData.globalStats?.processingOrdersCount) || 0,
            cancellationRate: Number(existingData.globalStats?.cancellationRate) || 0
          },
          dailyStats: existingData.dailyStats || {},
          logs: existingData.logs || []
        };
      }

      // 2. Perform pure in-memory delta calculations
      if (newStatus && newStatus !== oldStatus) {
        // 1. Subtract the original contribution (using old status as existing reference)
        applyAnalyticsDeltaInMemory(analytics, { ...existingOrder, status: oldStatus }, -1);
        
        // 2. Add the updated contribution (using new status)
        applyAnalyticsDeltaInMemory(analytics, { ...existingOrder, ...orderData, status: newStatus }, 1);
        
        // Unify to avoid multiple calculations in highly concurrent environments
        orderData.analyticsAppliedStatus = newStatus;
      }

      // 3. Perform ALL writes afterwards!
      transaction.set(analyticsRef, analytics);
      const isCancelling = orderData.status === 'cancelled';
      const cancelPayload = isCancelling ? {
        cancelledAt: serverTimestamp(),
        archived: true
      } : {
        archived: orderData.archived !== undefined ? orderData.archived : false
      };
      transaction.update(docRef, {
        ...orderData,
        ...cancelPayload,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ORDERS_COLLECTION}/${id}`);
  }
};

export const deleteOrder = async (id: string) => {
  try {
    const docRef = doc(db, ORDERS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ORDERS_COLLECTION}/${id}`);
  }
};

export const getUsers = async () => {
  try {
    const q = query(collection(db, USERS_COLLECTION), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, USERS_COLLECTION);
  }
};
