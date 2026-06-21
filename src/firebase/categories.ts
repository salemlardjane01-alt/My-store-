import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { saveToLocalCache, getFromLocalCache, invalidateCache } from '../lib/cacheHelper';

const CATEGORIES_COLLECTION = 'categories';
let cachedCategories: any[] | null = null;

export const getCategories = async (forceFresh = false) => {
  try {
    if (cachedCategories && !forceFresh) {
      return cachedCategories;
    }
    
    const cached = getFromLocalCache<any[]>('categories');
    if (cached && !forceFresh) {
      cachedCategories = cached.data;
      const TTL = 1800000; // 30 mins
      if (Date.now() - cached.timestamp < TTL) {
        return cached.data;
      }
      
      // Expired: Background update
      (async () => {
        try {
          const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('displayOrder', 'asc'));
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          cachedCategories = data;
          saveToLocalCache('categories', data);
        } catch (err) {
          console.warn("Background categories fetch failed:", err);
        }
      })();
      
      return cached.data;
    }
    
    const q = query(collection(db, CATEGORIES_COLLECTION), orderBy('displayOrder', 'asc'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    cachedCategories = data;
    saveToLocalCache('categories', data);
    return data;
  } catch (error) {
    // Treat error gracefully if collection does not exist yet or displayOrder does not have index
    try {
      const qFallback = query(collection(db, CATEGORIES_COLLECTION));
      const snapshot = await getDocs(qFallback);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      cachedCategories = data;
      saveToLocalCache('categories', data);
      return data;
    } catch (fallbackError) {
      handleFirestoreError(fallbackError, OperationType.LIST, CATEGORIES_COLLECTION);
    }
  }
};

export const addCategory = async (categoryData: any) => {
  try {
    const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), {
      ...categoryData,
      createdAt: serverTimestamp()
    });
    cachedCategories = null; // Invalidate memory cache
    invalidateCache('shoplix_cache_categories');
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, CATEGORIES_COLLECTION);
  }
};

export const updateCategory = async (id: string, categoryData: any) => {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await updateDoc(docRef, {
      ...categoryData,
      updatedAt: serverTimestamp()
    });
    cachedCategories = null; // Invalidate memory cache
    invalidateCache('shoplix_cache_categories');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CATEGORIES_COLLECTION}/${id}`);
  }
};

export const deleteCategory = async (id: string) => {
  try {
    const docRef = doc(db, CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef);
    cachedCategories = null; // Invalidate memory cache
    invalidateCache('shoplix_cache_categories');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${CATEGORIES_COLLECTION}/${id}`);
  }
};
