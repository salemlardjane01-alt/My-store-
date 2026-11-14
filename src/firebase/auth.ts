import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, orderBy, getDocs } from 'firebase/firestore';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from './config';

export const USERS_COLLECTION = 'users';

export const getUserProfileDocument = async (uid: string) => {
  if (!uid) return null;
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const snapShot = await getDoc(userRef);
    if (snapShot.exists()) {
      return snapShot.data();
    }
  } catch (error) {
    console.error("Error fetching user profile", error);
  }
  return null;
};

export const createUserProfileDocument = async (userAuth: any, additionalData: any = {}) => {
  if (!userAuth) return;

  const userRef = doc(db, USERS_COLLECTION, userAuth.uid);
  const snapShot = await getDoc(userRef);

  if (!snapShot.exists()) {
    const { displayName, email, photoURL } = userAuth;
    const role = 'user';
    try {
      await setDoc(userRef, {
        uid: userAuth.uid,
        name: displayName,
        email,
        photoURL,
        role,
        createdAt: serverTimestamp(),
        ...additionalData
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, USERS_COLLECTION);
    }
  }
  return userRef;
};

export const signInWithGoogle = async () => {
  try {
    const { user } = await signInWithPopup(auth, googleProvider);
    await createUserProfileDocument(user);
    return user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
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

export const checkIsAdmin = async (uid: string): Promise<boolean> => {
  if (!uid) return false;
  if (auth.currentUser?.email?.toLowerCase() === 'salemlardjane01@gmail.com' && auth.currentUser?.emailVerified) {
    return true;
  }
  try {
    const adminRef = doc(db, 'admins', uid);
    const snap = await getDoc(adminRef);
    return snap.exists();
  } catch {
    return false;
  }
};
