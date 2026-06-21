import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
