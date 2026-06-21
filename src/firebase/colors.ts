import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp, 
  writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { PRODUCTS_COLLECTION, invalidateProductsCache } from './products';

export const COLORS_COLLECTION = 'colors';
let cachedColors: any[] | null = null;

export const getColors = async () => {
  try {
    if (cachedColors) {
      return cachedColors;
    }
    const q = query(collection(db, COLORS_COLLECTION), orderBy('colorName', 'asc'));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
    
    // Clean and validate global database colors
    const validColors = data.filter((col: any) => {
      if (!col) return false;
      const name = col.colorName?.trim() || '';
      const code = col.colorCode?.trim() || '';
      return name && code && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(code);
    });

    cachedColors = validColors;
    return validColors;
  } catch (error) {
    try {
      const qFallback = query(collection(db, COLORS_COLLECTION));
      const snapshot = await getDocs(qFallback);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      
      const validColors = data.filter((col: any) => {
        if (!col) return false;
        const name = col.colorName?.trim() || '';
        const code = col.colorCode?.trim() || '';
        return name && code && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(code);
      });

      cachedColors = validColors;
      return validColors;
    } catch (fallbackError) {
      handleFirestoreError(fallbackError, OperationType.LIST, COLORS_COLLECTION);
    }
  }
};

export const addColorDoc = async (colorData: any) => {
  try {
    const docRef = await addDoc(collection(db, COLORS_COLLECTION), {
      ...colorData,
      createdAt: serverTimestamp()
    });
    cachedColors = null; // Invalidate cache
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLORS_COLLECTION);
  }
};

export const updateColorDoc = async (id: string, colorData: any) => {
  try {
    const docRef = doc(db, COLORS_COLLECTION, id);
    await updateDoc(docRef, {
      colorName: colorData.colorName,
      colorCode: colorData.colorCode,
      updatedAt: serverTimestamp()
    });
    cachedColors = null; // Invalidate cache

    // Cascaded Update across all products containing this color
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    const prodsSnap = await getDocs(productsRef);
    const batch = writeBatch(db);
    let updatedProducts = 0;

    prodsSnap.docs.forEach((prodDoc) => {
      const pData = prodDoc.data();
      if (pData.colors && Array.isArray(pData.colors)) {
        let isModified = false;
        const updatedColors = pData.colors.map((c: any) => {
          if (c && typeof c === 'object') {
            if (c.id === id || (c.colorName === colorData.oldColorName && c.colorCode === colorData.oldColorCode)) {
              isModified = true;
              return { id, colorName: colorData.colorName, colorCode: colorData.colorCode };
            }
          }
          return c;
        });

        if (isModified) {
          batch.update(prodDoc.ref, { colors: updatedColors });
          updatedProducts++;
        }
      }
    });

    if (updatedProducts > 0) {
      await batch.commit();
      invalidateProductsCache(); // Invalidate cached products
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLORS_COLLECTION}/${id}`);
  }
};

export const deleteColorDoc = async (id: string, colorName: string, colorCode: string) => {
  try {
    const docRef = doc(db, COLORS_COLLECTION, id);
    await deleteDoc(docRef);
    cachedColors = null; // Invalidate cache

    // Cascaded deletion: remove from all products container
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    const prodsSnap = await getDocs(productsRef);
    const batch = writeBatch(db);
    let updatedProducts = 0;

    prodsSnap.docs.forEach((prodDoc) => {
      const pData = prodDoc.data();
      if (pData.colors && Array.isArray(pData.colors)) {
        const filteredColors = pData.colors.filter((c: any) => {
          if (c && typeof c === 'object') {
            if (c.id === id) return false;
            if (c.colorName === colorName && c.colorCode === colorCode) return false;
          }
          return true;
        });

        if (filteredColors.length !== pData.colors.length) {
          batch.update(prodDoc.ref, { colors: filteredColors });
          updatedProducts++;
        }
      }
    });

    if (updatedProducts > 0) {
      await batch.commit();
      invalidateProductsCache(); // Invalidate cache
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLORS_COLLECTION}/${id}`);
  }
};
