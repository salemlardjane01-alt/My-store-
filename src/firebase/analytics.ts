import { 
  doc, 
  getDoc, 
  getDocs, 
  collection, 
  writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, ORDERS_COLLECTION } from './config';

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
