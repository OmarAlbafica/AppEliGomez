import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';

export interface Usuario {
  uid: string;
  nombre: string;
  apellido: string;
  correo: string;
  usuario: string;
  activo: boolean;
}

export const authService = {
  // Registrar usuario
  async registrar(
    nombre: string,
    apellido: string,
    correo: string,
    usuario: string,
    contrasena: string
  ): Promise<{ success: boolean; mensaje: string; usuario?: Usuario }> {
    try {
      const emailLower = correo.toLowerCase().trim();
      const usuarioLower = usuario.toLowerCase().trim();

      // Validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailLower)) {
        return { success: false, mensaje: 'Email inválido' };
      }

      // Validar contraseña
      if (contrasena.length < 6) {
        return { success: false, mensaje: 'La contraseña debe tener al menos 6 caracteres' };
      }

      // Verificar que el email no exista
      const q1 = query(collection(db, 'usuarios'), where('correo', '==', emailLower));
      const resultado1 = await getDocs(q1);
      if (!resultado1.empty) {
        return { success: false, mensaje: 'El correo ya está registrado' };
      }

      // Verificar que el usuario no exista
      const q2 = query(collection(db, 'usuarios'), where('usuario', '==', usuarioLower));
      const resultado2 = await getDocs(q2);
      if (!resultado2.empty) {
        return { success: false, mensaje: 'El usuario ya existe' };
      }

      const credencial = await createUserWithEmailAndPassword(auth, emailLower, contrasena);
      const uid = credencial.user.uid;

      const nuevoUsuario: Usuario = {
        uid,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        correo: emailLower,
        usuario: usuarioLower,
        activo: true,
      };

      await setDoc(doc(db, 'usuarios', uid), nuevoUsuario);

      return {
        success: true,
        mensaje: 'Usuario registrado exitosamente',
        usuario: nuevoUsuario,
      };
    } catch (error: any) {
      console.error('Error registro:', error);
      return { success: false, mensaje: error.message || 'Error al registrar' };
    }
  },

  // Iniciar sesión
  async login(
    identificador: string,
    contrasena: string
  ): Promise<{ success: boolean; mensaje: string; usuario?: Usuario }> {
    try {
      console.log('🔐 Iniciando login para:', identificador);
      let correo = identificador.toLowerCase().trim();

      // Si no tiene @, buscar el correo del usuario
      if (!identificador.includes('@')) {
        console.log('👤 Buscando email para usuario:', identificador);
        const q = query(collection(db, 'usuarios'), where('usuario', '==', identificador.toLowerCase().trim()));
        const resultado = await getDocs(q);

        if (resultado.empty) {
          console.log('❌ Usuario no encontrado:', identificador);
          return { success: false, mensaje: 'Usuario no encontrado' };
        }

        correo = resultado.docs[0].data().correo;
        console.log('✅ Email encontrado:', correo);
      }

      console.log('🔑 Intentando autenticación con email:', correo);
      const credencial = await signInWithEmailAndPassword(auth, correo, contrasena);
      console.log('✅ Autenticación exitosa, UID:', credencial.user.uid);
      
      const docRef = doc(db, 'usuarios', credencial.user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const usuario = docSnap.data() as Usuario;
        console.log('✅ Usuario datos obtenidos:', usuario);
        return {
          success: true,
          mensaje: 'Sesión iniciada',
          usuario,
        };
      }

      console.log('❌ Datos del usuario no encontrados en Firestore');
      return { success: false, mensaje: 'No se encontraron datos del usuario' };
    } catch (error: any) {
      console.error('❌ Error login:', error.code, error.message);
      return { success: false, mensaje: error.message || 'Usuario o contraseña incorrectos' };
    }
  },

  // Cerrar sesión
  async logout(): Promise<void> {
    await signOut(auth);
  },

  // Obtener usuario actual
  getCurrentUser(): Promise<Usuario | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const docRef = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            resolve(docSnap.data() as Usuario);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
        unsubscribe();
      });
    });
  },

  // Escuchar cambios en el usuario
  onUserChanged(callback: (usuario: Usuario | null) => void): (() => void) {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, 'usuarios', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          callback(docSnap.data() as Usuario);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },
};
