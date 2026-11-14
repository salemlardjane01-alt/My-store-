import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { saveToLocalCache, getFromLocalCache, invalidateCache } from '../lib/cacheHelper';

export const SHIPPING_RATES_COLLECTION = 'shipping_rates';

export let cachedShippingRates: any[] | null = null;

export const getShippingRates = async (forceFresh = false) => {
  try {
    if (cachedShippingRates && !forceFresh) {
      return cachedShippingRates;
    }
    
    const cached = getFromLocalCache<any[]>('shipping_rates');
    if (cached && !forceFresh) {
      cachedShippingRates = cached.data;
      const TTL = 3600000; // 60 mins
      if (Date.now() - cached.timestamp < TTL) {
        return cached.data;
      }
      
      // Expired: Background update
      (async () => {
        try {
          const q = query(collection(db, SHIPPING_RATES_COLLECTION));
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          cachedShippingRates = data;
          saveToLocalCache('shipping_rates', data);
        } catch (err) {
          console.warn("Background shipping rates fetch failed:", err);
        }
      })();
      
      return cached.data;
    }
    
    const q = query(collection(db, SHIPPING_RATES_COLLECTION));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    cachedShippingRates = data;
    saveToLocalCache('shipping_rates', data);
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, SHIPPING_RATES_COLLECTION);
  }
};

export const updateShippingRate = async (rateData: any) => {
  if (!rateData || !rateData.wilayaId) {
    throw new Error('wilayaId is required to update shipping rate');
  }
  const idStr = rateData.wilayaId;
  try {
    const docRef = doc(db, SHIPPING_RATES_COLLECTION, idStr);
    await setDoc(docRef, {
      ...rateData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    cachedShippingRates = null; // Invalidate memory cache
    invalidateCache('shipping_rates');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SHIPPING_RATES_COLLECTION}/${idStr}`);
  }
};
