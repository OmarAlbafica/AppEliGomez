import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../environments/firebase.config';
import { environment } from '../../../environments/environment';
import { Tienda } from '../../models/tienda.model';

@Injectable({
  providedIn: 'root'
})
export class TiendasService {
  private tiendas = new BehaviorSubject<Tienda[]>([]);
  public tiendas$ = this.tiendas.asObservable();

  constructor() {}

  /**
   * Carga todas las tiendas del usuario actual
   */
  cargarTiendas(): Observable<Tienda[]> {
    if (this.tiendas.value.length === 0) {
      this.cargarTiendasInterno();
    }
    return this.tiendas$;
  }

  /**
   * Carga tiendas desde Firestore (interno)
   */
  private async cargarTiendasInterno() {
    try {
      const tiendasRef = collection(db, 'tiendas');
      const q = query(tiendasRef);
      const snapshot = await getDocs(q);

      const tiendas: Tienda[] = [];
      snapshot.forEach(doc => {
        const tienda: Tienda = {
          id: doc.id,
          ...doc.data()
        } as Tienda;
        tiendas.push(tienda);
      });

      console.log('Tiendas cargadas:', tiendas);
      this.tiendas.next(tiendas);
    } catch (error) {
      console.error('Error cargando tiendas:', error);
    }
  }

  /**
   * Obtiene una tienda por ID
   */
  async obtenerTiendaPorId(tienda_id: string): Promise<Tienda | null> {
    try {
      const tiendaDoc = doc(db, 'tiendas', tienda_id);
      const snapshot = await getDocs(query(collection(db, 'tiendas'), where('id', '==', tienda_id)));
      if (snapshot.empty) {
        return null;
      }
      const tienda: Tienda = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      } as Tienda;
      return tienda;
    } catch (error) {
      console.error('Error obteniendo tienda:', error);
      return null;
    }
  }

  /**
   * Crea una nueva tienda
   */
  async crearTienda(tienda: Omit<Tienda, 'id' | 'fecha_creacion'>): Promise<string> {
    try {
      const usuario_id = auth.currentUser?.uid;
      if (!usuario_id) {
        throw new Error('Usuario no autenticado');
      }

      const tiendasRef = collection(db, 'tiendas');
      const tiendaData = {
        ...tienda,
        usuario_id,
        fecha_creacion: new Date()
      };

      const docRef = await addDoc(tiendasRef, tiendaData);
      console.log('Tienda creada con ID:', docRef.id);
      
      // Recargar tiendas
      this.cargarTiendasInterno();
      
      return docRef.id;
    } catch (error) {
      console.error('Error creando tienda:', error);
      throw error;
    }
  }

  /**
   * Actualiza una tienda existente
   */
  async actualizarTienda(tienda_id: string, tienda: Partial<Tienda>): Promise<void> {
    try {
      const tiendaRef = doc(db, 'tiendas', tienda_id);
      await updateDoc(tiendaRef, tienda);
      console.log('Tienda actualizada:', tienda_id);
      
      // Recargar tiendas
      this.cargarTiendasInterno();
    } catch (error) {
      console.error('Error actualizando tienda:', error);
      throw error;
    }
  }

  /**
   * Elimina una tienda
   */
  async eliminarTienda(tienda_id: string): Promise<void> {
    try {
      const tiendaRef = doc(db, 'tiendas', tienda_id);
      await deleteDoc(tiendaRef);
      console.log('Tienda eliminada:', tienda_id);
      
      // Recargar tiendas
      this.cargarTiendasInterno();
    } catch (error) {
      console.error('Error eliminando tienda:', error);
      throw error;
    }
  }

  /**
   * Obtiene tiendas del usuario actual desde el array en memoria
   */
  obtenerTiendasActuales(): Tienda[] {
    return this.tiendas.value;
  }

  /**
   * Carga una imagen de tienda usando la MISMA Cloud Function que productos
   * Esto garantiza que funcione igual de bien que en productos
   */
  async cargarImagenTienda(file: File, nombreTienda: string): Promise<string> {
    try {
      const usuario_id = auth.currentUser?.uid;
      if (!usuario_id) throw new Error('Usuario no autenticado');

      console.log(`📤 Subiendo imagen de tienda: ${nombreTienda}`);
      
      // Usar la misma Cloud Function que productos
      const CLOUD_FUNCTION_URL = 'https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/v2/subirProducto';
      
      // Comprimir imagen
      const imagenComprimida = await this.comprimirImagen(file);
      const base64String = await this.blobToBase64(imagenComprimida);
      
      // Llamar Cloud Function con parámetros especiales para tiendas
      const response = await fetch(CLOUD_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          archivoBase64: base64String,
          usuario_id,
          album: 'tiendas',  // Guardar en carpeta tiendas
          codigo: `${nombreTienda}-${Date.now()}`
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Cloud Function error ${response.status}: ${errorData}`);
      }

      const result = await response.json();
      const url_imagen = result.url_imagen;
      
      console.log(`✅ Imagen de tienda subida: ${url_imagen.substring(0, 50)}...`);
      return url_imagen;
      
    } catch (error) {
      console.error('Error cargando imagen de tienda:', error);
      throw error;
    }
  }

  /**
   * Comprime una imagen (reutilizado de ProductosService)
   */
  private async comprimirImagen(file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.75): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('No se pudo crear el blob'));
                }
              },
              'image/jpeg',
              quality
            );
          } else {
            reject(new Error('No se pudo obtener el contexto 2D'));
          }
        };
        
        img.onerror = () => reject(new Error('Error cargando imagen'));
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convierte Blob a Base64 (reutilizado de ProductosService)
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
