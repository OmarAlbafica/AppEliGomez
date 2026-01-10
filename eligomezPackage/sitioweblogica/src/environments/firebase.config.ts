// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// TODO: Reemplaza esto con tu configuración real de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDummyKeyChangeMe",
  authDomain: "eli-gomez-web.firebaseapp.com",
  projectId: "eli-gomez-web",
  storageBucket: "eli-gomez-web.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Para desarrollo, desactiva persistencia de Firebase en navegador si es necesario
if (typeof window !== 'undefined') {
  // Aquí puedes agregar más configuraciones específicas del navegador
}
