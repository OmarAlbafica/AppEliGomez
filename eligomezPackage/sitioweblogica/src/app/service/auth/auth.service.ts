import { Injectable } from '@angular/core';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  User,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  where, 
  getDocs,
  Firestore
} from 'firebase/firestore';
import { auth, db } from '../../environments/firebase.config';
import { BehaviorSubject, Observable } from 'rxjs';
import * as bcrypt from 'bcryptjs';

export interface UsuarioFirebase {
  uid: string;
  nombre: string;
  apellido: string;
  correo: string;
  usuario: string;
  contrasena_encriptada: string;
  fecha_registro: Date;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private usuarioActual = new BehaviorSubject<UsuarioFirebase | null>(null);
  public usuarioActual$ = this.usuarioActual.asObservable();

  private isLoading = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoading.asObservable();

  constructor() {
    this.verificarUsuarioActual();
  }

  /**
   * Verifica si hay usuario autenticado al cargar
   */
  private verificarUsuarioActual(): void {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        const usuarioFirebase = await this.obtenerUsuarioDeFirestore(user.uid);
        this.usuarioActual.next(usuarioFirebase);
      } else {
        this.usuarioActual.next(null);
      }
    });
  }

  /**
   * Registra un nuevo usuario con validaciones
   */
  async registrarUsuario(
    nombre: string,
    apellido: string,
    correo: string,
    usuario: string,
    contrasena: string
  ): Promise<{ success: boolean; mensaje: string; usuario?: UsuarioFirebase }> {
    this.isLoading.next(true);

    try {
      // Validaciones
      if (!nombre || !apellido || !correo || !usuario || !contrasena) {
        return { success: false, mensaje: 'Todos los campos son requeridos' };
      }

      // Validar que el correo no exista
      const correoExiste = await this.verificarCorreoExistente(correo);
      if (correoExiste) {
        return { success: false, mensaje: 'El correo ya está registrado' };
      }

      // Validar que el usuario no exista
      const usuarioExiste = await this.verificarUsuarioExistente(usuario);
      if (usuarioExiste) {
        return { success: false, mensaje: 'El usuario ya existe' };
      }

      // Crear usuario en Firebase Auth
      const credenciales = await createUserWithEmailAndPassword(auth, correo, contrasena);
      const uid = credenciales.user.uid;

      // Encriptar contraseña para almacenarla en Firestore (adicional de seguridad)
      const contrasenaEncriptada = await bcrypt.hash(contrasena, 10);

      // Crear documento del usuario en Firestore
      const usuarioNuevo: UsuarioFirebase = {
        uid,
        nombre,
        apellido,
        correo,
        usuario,
        contrasena_encriptada: contrasenaEncriptada,
        fecha_registro: new Date(),
        activo: true
      };

      const docRef = doc(db, 'usuarios', uid);
      await setDoc(docRef, {
        ...usuarioNuevo,
        fecha_registro: usuarioNuevo.fecha_registro.toISOString()
      });

      // Actualizar profile de Firebase Auth
      await updateProfile(credenciales.user, {
        displayName: `${nombre} ${apellido}`
      });

      this.usuarioActual.next(usuarioNuevo);
      this.isLoading.next(false);

      return { 
        success: true, 
        mensaje: 'Usuario registrado exitosamente',
        usuario: usuarioNuevo
      };

    } catch (error: any) {
      console.error('Error en registro:', error);
      this.isLoading.next(false);

      // Mapear errores de Firebase
      const mensajeError = this.mapearErrorFirebase(error.code);
      return { success: false, mensaje: mensajeError };
    }
  }

  /**
   * Inicia sesión con usuario o correo
   */
  async loginUsuario(
    identificador: string, // puede ser usuario o correo
    contrasena: string
  ): Promise<{ success: boolean; mensaje: string; usuario?: UsuarioFirebase }> {
    this.isLoading.next(true);

    try {
      if (!identificador || !contrasena) {
        return { success: false, mensaje: 'Usuario/Correo y contraseña son requeridos' };
      }

      let correo: string = identificador;

      // Si el identificador no contiene @, buscar el correo asociado al usuario
      if (!identificador.includes('@')) {
        const correoEncontrado = await this.obtenerCorreoPorUsuario(identificador);
        if (!correoEncontrado) {
          return { success: false, mensaje: 'Usuario no encontrado' };
        }
        correo = correoEncontrado;
      }

      // Iniciar sesión con Firebase Auth
      const credenciales = await signInWithEmailAndPassword(auth, correo, contrasena);
      const usuarioFirestore = await this.obtenerUsuarioDeFirestore(credenciales.user.uid);

      if (usuarioFirestore) {
        this.usuarioActual.next(usuarioFirestore);
        this.isLoading.next(false);

        return { 
          success: true, 
          mensaje: 'Sesión iniciada correctamente',
          usuario: usuarioFirestore
        };
      } else {
        return { success: false, mensaje: 'No se encontraron datos del usuario' };
      }

    } catch (error: any) {
      console.error('Error en login:', error);
      this.isLoading.next(false);

      const mensajeError = this.mapearErrorFirebase(error.code);
      return { success: false, mensaje: mensajeError };
    }
  }

  /**
   * Cierra la sesión del usuario
   */
  async logout(): Promise<void> {
    try {
      await signOut(auth);
      this.usuarioActual.next(null);
    } catch (error) {
      console.error('Error en logout:', error);
    }
  }

  /**
   * Verifica si el correo ya existe en Firestore
   */
  private async verificarCorreoExistente(correo: string): Promise<boolean> {
    const q = query(
      collection(db, 'usuarios'),
      where('correo', '==', correo.toLowerCase())
    );
    const resultado = await getDocs(q);
    return !resultado.empty;
  }

  /**
   * Verifica si el usuario ya existe en Firestore
   */
  private async verificarUsuarioExistente(usuario: string): Promise<boolean> {
    const q = query(
      collection(db, 'usuarios'),
      where('usuario', '==', usuario.toLowerCase())
    );
    const resultado = await getDocs(q);
    return !resultado.empty;
  }

  /**
   * Obtiene el correo asociado a un usuario
   */
  private async obtenerCorreoPorUsuario(usuario: string): Promise<string | null> {
    const q = query(
      collection(db, 'usuarios'),
      where('usuario', '==', usuario.toLowerCase())
    );
    const resultado = await getDocs(q);
    
    if (resultado.empty) return null;
    
    const doc = resultado.docs[0];
    return doc.data()['correo'];
  }

  /**
   * Obtiene el documento del usuario desde Firestore
   */
  private async obtenerUsuarioDeFirestore(uid: string): Promise<UsuarioFirebase | null> {
    try {
      const docRef = doc(db, 'usuarios', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          fecha_registro: new Date(data['fecha_registro'])
        } as UsuarioFirebase;
      }

      return null;
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }
  }

  /**
   * Mapea códigos de error de Firebase a mensajes en español
   */
  private mapearErrorFirebase(errorCode: string): string {
    const errores: { [key: string]: string } = {
      'auth/email-already-in-use': 'El correo ya está registrado',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
      'auth/invalid-email': 'Formato de correo inválido',
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/invalid-credential': 'Usuario o contraseña incorrectos',
      'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde',
      'auth/operation-not-allowed': 'Operación no permitida'
    };

    return errores[errorCode] || 'Error de autenticación. Intenta de nuevo';
  }

  /**
   * Obtiene el usuario actual
   */
  obtenerUsuarioActual(): UsuarioFirebase | null {
    return this.usuarioActual.value;
  }

  /**
   * Obtiene el usuario actual como Observable
   */
  obtenerUsuarioActual$(): Observable<UsuarioFirebase | null> {
    return this.usuarioActual.asObservable();
  }
}
