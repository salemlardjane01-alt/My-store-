import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  serverTimestamp,
  where,
  limit
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, getStorageInstance, handleFirestoreError, OperationType } from './config';
import { saveToLocalCache, getFromLocalCache, invalidateCache } from '../lib/cacheHelper';
import { Product } from '../types';

export const PRODUCTS_COLLECTION = 'products';

let cachedProducts: any[] | null = null;

export const invalidateProductsCache = () => {
  cachedProducts = null;
  invalidateCache('products');
};

export const getProducts = async (forceFresh = false) => {
  try {
    if (cachedProducts && !forceFresh) {
      return cachedProducts;
    }
    
    const cached = getFromLocalCache<any[]>('products');
    if (cached && !forceFresh) {
      cachedProducts = cached.data;
      const TTL = 300000; // 5 minutes standard for lists
      if (Date.now() - cached.timestamp < TTL) {
        return cached.data;
      }
      
      // Expired: Background update
      (async () => {
        try {
          const q = query(collection(db, PRODUCTS_COLLECTION));
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          cachedProducts = data;
          saveToLocalCache('products', data);
        } catch (err) {
          console.warn("Background product fetch failed:", err);
        }
      })();
      
      return cached.data;
    }
    
    // No cache or forceFresh: Foreground fetch
    const q = query(collection(db, PRODUCTS_COLLECTION));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    cachedProducts = data;
    saveToLocalCache('products', data);
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PRODUCTS_COLLECTION);
  }
};

export const getProductsWithLimit = async (limitNum: number, categoryId: string = 'all', forceFresh = false) => {
  try {
    // If cache is loaded and we are not forcing fresh, return from memory
    if (cachedProducts && !forceFresh) {
      let filtered = cachedProducts;
      if (categoryId && categoryId !== 'all') {
        filtered = cachedProducts.filter((p: any) => p.categoryId === categoryId);
      }
      return filtered.slice(0, limitNum);
    }

    const cached = getFromLocalCache<any[]>('products');
    if (cached && !forceFresh) {
      cachedProducts = cached.data;
      let filtered = cached.data;
      if (categoryId && categoryId !== 'all') {
        filtered = cached.data.filter((p: any) => p.categoryId === categoryId);
      }
      
      // Check TTL and fetch background if needed
      const TTL = 300000; // 5 minutes
      if (Date.now() - cached.timestamp >= TTL) {
        getProducts().catch(err => console.warn(err));
      }
      return filtered.slice(0, limitNum);
    }

    const constraints = categoryId && categoryId !== 'all'
      ? [where('categoryId', '==', categoryId), limit(limitNum)]
      : [limit(limitNum)];
    const targetedQuery = query(collection(db, PRODUCTS_COLLECTION), ...constraints);
    const snapshot = await getDocs(targetedQuery);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return data;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, PRODUCTS_COLLECTION);
    return [];
  }
};

export const getProductById = async (id: string) => {
  try {
    if (cachedProducts) {
      const found = cachedProducts.find((p: any) => p.id === id);
      if (found) return found;
    }
    
    const cached = getFromLocalCache<any[]>('products');
    if (cached) {
      cachedProducts = cached.data;
      const found = cached.data.find((p: any) => p.id === id);
      if (found) {
        const TTL = 300000;
        if (Date.now() - cached.timestamp >= TTL) {
          getProducts().catch(err => console.warn(err));
        }
        return found;
      }
    }
    
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${PRODUCTS_COLLECTION}/${id}`);
  }
};

export const addProduct = async (productData: Omit<Product, 'id'>) => {
  try {
    const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
      ...productData,
      createdAt: serverTimestamp()
    });
    invalidateProductsCache();
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, PRODUCTS_COLLECTION);
  }
};

export const updateProduct = async (id: string, productData: Partial<Product>) => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...productData,
      updatedAt: serverTimestamp()
    });
    invalidateProductsCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${PRODUCTS_COLLECTION}/${id}`);
  }
};

export const deleteProduct = async (id: string) => {
  try {
    const docRef = doc(db, PRODUCTS_COLLECTION, id);
    await deleteDoc(docRef);
    invalidateProductsCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${PRODUCTS_COLLECTION}/${id}`);
  }
};

export interface ImageUploadResult {
  url: string;
  usedFallback: boolean;
  errorReason?: string;
}

export const estimateDocumentBytes = (data: unknown): number => {
  try {
    const json = JSON.stringify(data);
    return new Blob([json]).size;
  } catch {
    return 0;
  }
};

let storageSkipUntil = 0;
let lastStorageSkipReason = '';

const compressImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 600;
        const maxH = 750;
        let width = img.width;
        let height = img.height;

        if (width > maxW) {
          height = Math.round((height * maxW) / width);
          width = maxW;
        }
        if (height > maxH) {
          width = Math.round((width * maxH) / height);
          height = maxH;
        }

        const renderAtSize = (w: number, h: number, quality: number): string => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return (event.target?.result as string) || '';
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL('image/jpeg', quality);
        };

        // Adaptive JPEG compression so Base64 fallback stays under ~90KB per image
        let quality = 0.65;
        let compressedBase64 = renderAtSize(width, height, quality);
        while (compressedBase64.length > 90000 && quality > 0.35) {
          quality = Number((quality - 0.1).toFixed(2));
          compressedBase64 = renderAtSize(width, height, quality);
        }

        if (compressedBase64.length > 95000 && width > 400) {
          width = Math.round(width * 0.78);
          height = Math.round(height * 0.78);
          compressedBase64 = renderAtSize(width, height, 0.5);
        }

        resolve(compressedBase64);
      };
      img.onerror = () => {
        reject(new Error('IMAGE_DECODE_FAILED'));
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('FILE_READ_FAILED'));
    };
    reader.readAsDataURL(file);
  });
};

export const uploadImageDetailed = async (
  file: File,
  folder: string,
  timeoutMs: number
): Promise<ImageUploadResult> => {
  if (Date.now() < storageSkipUntil) {
    const compressed = await compressImageToBase64(file);
    return {
      url: compressed,
      usedFallback: true,
      errorReason: lastStorageSkipReason || 'Firebase Storage unavailable',
    };
  }

  const uploadPromise = (async () => {
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const randomId = Math.random().toString(36).substring(2, 10);
    const fileName = `${Date.now()}_${randomId}.${fileExtension}`;
    const filePath = `${folder}/${fileName}`;
    const storageRef = ref(getStorageInstance(), filePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  })();

  const timeoutPromise = new Promise<string>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), timeoutMs);
  });

  try {
    const url = await Promise.race([uploadPromise, timeoutPromise]);
    storageSkipUntil = 0;
    lastStorageSkipReason = '';
    return { url, usedFallback: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('Storage upload failed or timed out. Falling back to compressed client-side Base64...', reason);
    if (
      reason.includes('retry-limit-exceeded') ||
      reason.includes('Timeout') ||
      reason.includes('bucket-not-found') ||
      reason.includes('unauthorized')
    ) {
      storageSkipUntil = Date.now() + 60000;
      lastStorageSkipReason = reason;
    }
    try {
      const compressed = await compressImageToBase64(file);
      if (compressed) {
        return { url: compressed, usedFallback: true, errorReason: reason };
      }
      throw error;
    } catch (compressError) {
      console.error('Base64 compression failed:', compressError);
      throw error;
    }
  }
};

export const uploadImage = async (file: File, folder: string, timeoutMs: number): Promise<string> => {
  const res = await uploadImageDetailed(file, folder, timeoutMs);
  return res.url;
};

export const uploadProductImageDetailed = (file: File): Promise<ImageUploadResult> =>
  uploadImageDetailed(file, 'products', 6000);

export const uploadProductImage = (file: File): Promise<string> => uploadImage(file, 'products', 6000);

export const deleteProductImageByUrl = async (url: string): Promise<void> => {
  if (!url) return;
  try {
    // If it is a Firebase storage download URL, we can attempt to delete it
    if (url.includes('firebasestorage.googleapis.com')) {
      const storageRef = ref(getStorageInstance(), url);
      await deleteObject(storageRef);
    }
  } catch (error) {
    console.warn("Could not delete image from Firebase Storage:", error);
  }
};
