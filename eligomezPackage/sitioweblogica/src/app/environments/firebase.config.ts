// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your web app's Firebase configuration
// TODO: Reemplaza esto con tu configuración real de Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyBFy_Zn3v757qNdVtBqYaLQ37IcAHfTqyE",
  authDomain: "eli-gomez-web.firebaseapp.com",
  projectId: "eli-gomez-web",
  storageBucket: "eli-gomez-web.firebasestorage.app",
  messagingSenderId: "1030711833270",
  appId: "1:1030711833270:web:b1240b744247dae99e2c17",
  measurementId: "G-3S9H50CX3Y"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Storage and get a reference to the service
export const storage = getStorage(app);

// Conectar a emuladores en desarrollo (localhost)
// DESACTIVADO - Usar producción de Firebase directamente
// const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

// if (!isProduction) {
//   console.log('🎯 Conectando a Firebase Emulators...');
//   // ... emulator code ...
// }

console.log('✅ Usando Firebase de PRODUCCIÓN');
console.log('📍 Hostname:', location.hostname);
console.log('🔑 Project:', firebaseConfig.projectId);
