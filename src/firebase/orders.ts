import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  runTransaction, 
  where,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, ORDERS_COLLECTION } from './config';
import { sendTelegramNotificationIfNeeded } from './telegram';
import { applyAnalyticsDeltaInMemory } from './analytics';
import { Order } from '../types';

export const createOrder = async (orderData: Omit<Order, 'id'>) => {
  try {
    const result = await runTransaction(db, async (transaction) => {
      const counterRef = doc(db, 'settings', 'counters');
      const analyticsRef = doc(db, 'analytics', 'dashboard');
      const settingsRef = doc(db, 'settings', 'telegram');
      
      // 1. Perform ALL reads first!
      const counterSnap = await transaction.get(counterRef);
      const analyticsSnap = await transaction.get(analyticsRef);
      const settingsSnap = await transaction.get(settingsRef);
      
      const productId = orderData.items?.[0]?.id;
      const quantity = orderData.items?.[0]?.quantity || 1;
      const productRef = productId ? doc(db, 'products', productId) : null;
      const productSnap = productRef ? await transaction.get(productRef) : null;
      
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
      
      if (productSnap && productSnap.exists()) {
        const currentStock = productSnap.data().stock;
        if (typeof currentStock === 'number' && currentStock < quantity) {
          throw new Error(`STOCK_INSUFFICIENT:${productId}`);
        }
      }
      
      // 2. Perform ALL writes afterwards
      transaction.set(orderRef, enrichedOrderData);
      if (productRef && productSnap && productSnap.exists() && typeof productSnap.data().stock === 'number') {
        transaction.update(productRef, { stock: increment(-quantity) });
      }
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

export const updateOrder = async (id: string, orderData: Partial<Order>) => {
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
