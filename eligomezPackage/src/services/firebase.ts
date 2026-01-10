import { initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBFy_Zn3v757qNdVtBqYaLQ37IcAHfTqyE",
  authDomain: "eli-gomez-web.firebaseapp.com",
  projectId: "eli-gomez-web",
  storageBucket: "eli-gomez-web.firebasestorage.app",
  messagingSenderId: "1030711833270",
  appId: "1:1030711833270:web:b1240b744247dae99e2c17",
  measurementId: "G-3S9H50CX3Y"
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: undefined // React Native maneja la persistencia automáticamente
});
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
