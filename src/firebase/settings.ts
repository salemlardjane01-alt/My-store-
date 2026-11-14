import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, SETTINGS_COLLECTION } from './config';
import { saveToLocalCache, getFromLocalCache } from '../lib/cacheHelper';
import { uploadImage } from './products';

export const HERO_DOCUMENT_ID = 'hero';
export const SOCIAL_DOCUMENT_ID = 'social';
export const DELIVERY_PROVIDERS_DOCUMENT_ID = 'delivery_providers';

export let cachedHeroSettings: any = null;
export let cachedSocialSettings: any = null;
export let cachedDeliverySettings: any = null;

export const getHeroSettings = async (forceFresh = false) => {
  try {
    if (cachedHeroSettings && !forceFresh) {
      return cachedHeroSettings;
    }
    
    const cached = getFromLocalCache<any>('hero_settings');
    if (cached && !forceFresh) {
      cachedHeroSettings = cached.data;
      const TTL = 900000; // 15 mins
      if (Date.now() - cached.timestamp < TTL) {
        return cached.data;
      }
      
      // Expired: Background update
      (async () => {
        try {
          const docRef = doc(db, SETTINGS_COLLECTION, HERO_DOCUMENT_ID);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            cachedHeroSettings = data;
            saveToLocalCache('hero_settings', data);
          }
        } catch (err) {
          console.warn("Background hero refresh failed:", err);
        }
      })();
      
      return cached.data;
    }
    
    const docRef = doc(db, SETTINGS_COLLECTION, HERO_DOCUMENT_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      cachedHeroSettings = data;
      saveToLocalCache('hero_settings', data);
      return data;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${HERO_DOCUMENT_ID}`);
  }
};

export const updateHeroSettings = async (settingsData: any) => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, HERO_DOCUMENT_ID);
    await setDoc(docRef, {
      ...settingsData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update both memory cache and local storage cache immediately with the new data
    cachedHeroSettings = settingsData;
    saveToLocalCache('hero_settings', settingsData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COLLECTION}/${HERO_DOCUMENT_ID}`);
  }
};

export const getSocialSettings = async (forceFresh = false) => {
  try {
    if (cachedSocialSettings && !forceFresh) {
      return cachedSocialSettings;
    }
    
    const cached = getFromLocalCache<any>('social_settings');
    if (cached && !forceFresh) {
      cachedSocialSettings = cached.data;
      const TTL = 3600000; // 60 mins
      if (Date.now() - cached.timestamp < TTL) {
        return cached.data;
      }
      
      // Expired: Background update
      (async () => {
        try {
          const docRef = doc(db, SETTINGS_COLLECTION, SOCIAL_DOCUMENT_ID);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            cachedSocialSettings = data;
            saveToLocalCache('social_settings', data);
          }
        } catch (err) {
          console.warn("Background social refresh failed", err);
        }
      })();
      
      return cached.data;
    }
    
    const docRef = doc(db, SETTINGS_COLLECTION, SOCIAL_DOCUMENT_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      cachedSocialSettings = data;
      saveToLocalCache('social_settings', data);
      return data;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${SOCIAL_DOCUMENT_ID}`);
  }
};

export const updateSocialSettings = async (settingsData: any) => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, SOCIAL_DOCUMENT_ID);
    await setDoc(docRef, {
      ...settingsData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update both memory cache and local storage cache immediately with the new data
    cachedSocialSettings = settingsData;
    saveToLocalCache('social_settings', settingsData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COLLECTION}/${SOCIAL_DOCUMENT_ID}`);
  }
};

export const uploadHeroImage = (file: File): Promise<string> => uploadImage(file, 'heroes', 6000);

export const getDeliveryProvidersSettings = async (forceFresh = false) => {
  try {
    if (cachedDeliverySettings && !forceFresh) {
      return cachedDeliverySettings;
    }
    
    const cached = getFromLocalCache<any>('delivery_providers_settings');
    if (cached && !forceFresh) {
      cachedDeliverySettings = cached.data;
      const TTL = 900000; // 15 mins
      if (Date.now() - cached.timestamp < TTL) {
        return cached.data;
      }
      
      // Expired: Background update
      (async () => {
        try {
          const docRef = doc(db, SETTINGS_COLLECTION, DELIVERY_PROVIDERS_DOCUMENT_ID);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            cachedDeliverySettings = data;
            saveToLocalCache('delivery_providers_settings', data);
          }
        } catch (err) {
          console.warn("Background delivery providers settings refresh failed:", err);
        }
      })();
      
      return cached.data;
    }
    
    const docRef = doc(db, SETTINGS_COLLECTION, DELIVERY_PROVIDERS_DOCUMENT_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      cachedDeliverySettings = data;
      saveToLocalCache('delivery_providers_settings', data);
      return data;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${DELIVERY_PROVIDERS_DOCUMENT_ID}`);
  }
};

export const updateDeliveryProvidersSettings = async (settingsData: any) => {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, DELIVERY_PROVIDERS_DOCUMENT_ID);
    await setDoc(docRef, {
      ...settingsData,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    // Update local cache
    cachedDeliverySettings = settingsData;
    saveToLocalCache('delivery_providers_settings', settingsData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COLLECTION}/${DELIVERY_PROVIDERS_DOCUMENT_ID}`);
  }
};
