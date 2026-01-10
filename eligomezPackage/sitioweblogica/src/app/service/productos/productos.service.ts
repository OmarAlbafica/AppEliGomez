import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getFirestore } from 'firebase/firestore';
import { db, auth } from '../../environments/firebase.config';

export interface Producto {
  id: string;
  usuario_id: string;
  codigo: string;           // 202512221 o meses1
  album: string;            // 20251222 o Meses
  numero: number;           // 1, 2, 3...
  url_imagen: string;       // URL de descarga
  url_thumbnail: string;    // URL miniatura
  tamaño_original: number;  // bytes
  tamaño_comprimido: number; // bytes
  fecha_carga: Date;
  reservado?: boolean;      // true si está en algún pedido
  pedido_id?: string;       // ID del pedido que la reserva
}

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private productos = new BehaviorSubject<Producto[]>([]);
  public productos$ = this.productos.asObservable();

  constructor() {}

  /**
   * Obtiene los productos actuales en memoria (sin esperar carga)
   */
  obtenerProductosActuales(): Producto[] {
    return this.productos.value;
  }

  /**
   * Carga todos los productos del usuario
   */
  cargarProductos(): Observable<Producto[]> {
    if (this.productos.value.length === 0) {
      this.cargarProductosInterno(); // Inicia carga pero no espera
    }
    return this.productos$;
  }

  /**
   * Recarga los productos forzadamente
   */
  async recargarProductos(): Promise<void> {
    let intentos = 0;
    const maxIntentos = 10;
    
    while (intentos < maxIntentos && !auth.currentUser?.uid) {
      console.log(`Esperando autenticación (productos)... intento ${intentos + 1}/${maxIntentos}`);
      await new Promise(resolve => setTimeout(resolve, 500));
      intentos++;
    }
    
    if (!auth.currentUser?.uid) {
      console.warn('No se pudo autenticar productos después de varios intentos');
      return;
    }
    
    await this.cargarProductosInterno(); // Espera a que complete
  }

  /**
   * Carga productos desde Firestore (interno)
   */
  private async cargarProductosInterno() {
    try {
      const usuario_id = auth.currentUser?.uid;
      if (!usuario_id) {
        console.warn('❌ Usuario no autenticado en cargarProductosInterno');
        return;
      }

      console.log(`✅ Cargando productos`);
      const productosRef = collection(db, 'productos');
      const q = query(productosRef);
      
      console.log('📊 Ejecutando query a Firestore...');
      const snapshot = await getDocs(q);

      console.log(`📊 Documentos encontrados: ${snapshot.size}`);

      if (snapshot.size === 0) {
        console.warn('⚠️ No se encontraron documentos para este usuario');
        this.productos.next([]);
        return;
      }

      const productos: Producto[] = [];
      snapshot.forEach(doc => {
        try {
          const docData = doc.data();

          const producto: Producto = {
            id: doc.id,
            usuario_id: docData['usuario_id'],
            codigo: docData['codigo'],
            album: docData['album'],
            numero: docData['numero'],
            url_imagen: docData['url_imagen'],
            url_thumbnail: docData['url_thumbnail'],
            tamaño_original: docData['tamaño_original'] || 0,
            tamaño_comprimido: docData['tamaño_comprimido'] || 0,
            fecha_carga: typeof docData['fecha_carga'] === 'string' 
              ? new Date(docData['fecha_carga']) 
              : docData['fecha_carga'].toDate?.() || new Date(),
            reservado: docData['reservado'] === true,
            pedido_id: docData['pedido_id']
          };
          productos.push(producto);
        } catch (docError) {
          console.error('❌ Error procesando documento de producto:', doc.id, docError);
        }
      });

      console.log(`✅ ${productos.length} productos procesados y listos para mostrar`);
      this.productos.next(productos.sort((a, b) => b.fecha_carga.getTime() - a.fecha_carga.getTime()));
    } catch (error) {
      console.error('❌ Error cargando productos:', error);
    }
  }

  /**
   * Comprime una imagen agresivamente
   * Optimizado para pasar de 5.75MB a ~100KB
   */
  async comprimirImagen(file: File, calidad: number = 0.55): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Reducir resolución significativamente
          let width = img.width;
          let height = img.height;
          const maxWidth = 800;   // Reducido de 2000 a 800
          const maxHeight = 800;
          
          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Dibujar imagen
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convertir a blob con JPEG muy comprimido
          canvas.toBlob(
            (blob) => {
              if (blob) {
                // Si el blob aún es muy grande, comprimir más
                if (blob.size > 150000) { // Si > 150KB, comprimir más
                  console.log(`Imagen muy grande (${(blob.size / 1024).toFixed(0)}KB), comprimiendo más...`);
                  canvas.toBlob(
                    (blob2) => {
                      resolve(blob2 || blob);
                    },
                    'image/jpeg',
                    0.45 // Calidad ultra-baja pero aceptable para productos
                  );
                } else {
                  resolve(blob);
                }
              } else {
                reject(new Error('No se pudo comprimir la imagen'));
              }
            },
            'image/jpeg',
            calidad
          );
        };
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
    });
  }

  /**
   * SOLUCIÓN FINAL: Carga imágenes usando Cloud Function como proxy
   * Cloud Functions = Sin CORS (backend)
   * @param files Lista de archivos
   * @param album Nombre del album (ej: 20251222 o Meses)
   * @param numeroInicio Número inicial (default 1)
   */
  async cargarImagenesLote(files: File[], album: string, numeroInicio: number = 1): Promise<Producto[]> {
    try {
      const usuario_id = auth.currentUser?.uid;
      if (!usuario_id) throw new Error('Usuario no autenticado');

      const productosCreados: Producto[] = [];
      const maxReintentos = 3;
      const CLOUD_FUNCTION_URL = 'https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/v2/subirProducto';
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const numero = numeroInicio + i;
        
        // Generar código
        const codigo = this.generarCodigo(album, numero);
        
        console.log(`📦 Comprimiendo imagen ${i + 1}/${files.length}: ${file.name}`);
        const imagenComprimida = await this.comprimirImagen(file);
        
        // Convertir a base64 para Cloud Function
        const base64String = await this.blobToBase64(imagenComprimida);
        
        console.log(`☁️ Subiendo vía Cloud Function: ${codigo}`);
        
        // Reintentos automáticos
        let intentoActual = 0;
        let exitoso = false;
        let ultimoError: any = null;
        let url_imagen = '';
        let url_thumbnail = '';
        
        while (intentoActual < maxReintentos && !exitoso) {
          try {
            intentoActual++;
            console.log(`🔄 Intento ${intentoActual}/${maxReintentos} para ${codigo}`);
            
            // Llamar Cloud Function
            console.log(`📤 Enviando a Cloud Function...`);
            const response = await fetch(CLOUD_FUNCTION_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                archivoBase64: base64String,
                usuario_id,
                album,
                codigo
              })
            });

            if (!response.ok) {
              const errorData = await response.text();
              throw new Error(`Cloud Function error ${response.status}: ${errorData}`);
            }

            const result = await response.json();
            url_imagen = result.url_imagen;
            url_thumbnail = result.url_thumbnail;
            
            console.log(`✅ Imagen subida por Cloud Function`);
            console.log(`🔗 URL obtenida: ${url_imagen.substring(0, 50)}...`);
            
            // GUARDAR METADATA EN FIRESTORE
            console.log(`💾 Guardando metadata en Firestore...`);
            const docRef = await addDoc(collection(db, 'productos'), {
              usuario_id,
              codigo,
              album,
              numero,
              url_imagen,
              url_thumbnail,
              tamaño_original: file.size,
              tamaño_comprimido: imagenComprimida.size,
              fecha_carga: new Date(),
              reservado: false,
              pedido_id: ''
            });
            
            console.log(`✅ Producto guardado en Firestore: ${codigo} (ID: ${docRef.id})`);
            
            // Crear objeto producto local
            const producto: Producto = {
              id: docRef.id,
              usuario_id,
              codigo,
              album,
              numero,
              url_imagen,
              url_thumbnail,
              tamaño_original: file.size,
              tamaño_comprimido: imagenComprimida.size,
              fecha_carga: new Date(),
              reservado: false,
              pedido_id: ''
            };
            
            productosCreados.push(producto);
            exitoso = true;
            
          } catch (error: any) {
            ultimoError = error;
            console.error(`❌ Intento ${intentoActual}/${maxReintentos} falló:`, error.message);
            
            if (intentoActual < maxReintentos) {
              // Esperar antes de reintentar (backoff exponencial)
              const tiempoEspera = Math.min(1000 * Math.pow(2, intentoActual - 1), 10000);
              console.log(`⏳ Esperando ${tiempoEspera}ms antes de reintentar...`);
              await new Promise(resolve => setTimeout(resolve, tiempoEspera));
            }
          }
        }
        
        if (!exitoso) {
          console.error(`❌ No se pudo subir ${codigo} después de ${maxReintentos} intentos:`, ultimoError);
          throw ultimoError;
        }
      }
      
      // Recargar productos después de subir todos
      console.log(`🎉 Todos los productos subidos. Recargando lista...`);
      await this.cargarProductosInterno();
      return productosCreados;
    } catch (error) {
      console.error('Error cargando imágenes:', error);
      throw error;
    }
  }

  /**
   * Convierte Blob/File a Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Genera un código para el producto
   */
  private generarCodigo(album: string, numero: number): string {
    // Si es un album numérico (fecha), concatenar
    if (/^\d+$/.test(album)) {
      return `${album}${numero}`;
    }
    // Si es un album con nombre, agregar número
    return `${album}${numero}`;
  }

  /**
   * Obtiene un producto por código
   */
  obtenerProductoPorCodigo(codigo: string): Producto | undefined {
    return this.productos.value.find(p => p.codigo === codigo);
  }

  /**
   * Busca productos por album
   */
  buscarPorAlbum(album: string): Producto[] {
    return this.productos.value.filter(p => p.album === album);
  }

  /**
   * Obtiene todos los albums únicos
   */
  obtenerAlbums(): string[] {
    const albums = new Set(this.productos.value.map(p => p.album));
    return Array.from(albums).sort((a, b) => b.localeCompare(a)); // Ordenar descendente
  }

  /**
   * Marca productos como reservados
   */
  async marcarComoReservados(productosIds: string[], pedidoId: string): Promise<void> {
    try {
      console.log('🔴 [MARCAR RESERVADOS] Iniciando...');
      console.log('IDs a marcar como reservados:', productosIds);
      console.log('Pedido ID:', pedidoId);
      
      const productosActuales = this.productos.value;
      console.log('Productos en memoria ANTES:', productosActuales.length);
      
      for (const productoId of productosIds) {
        console.log(`  - Procesando producto ID: ${productoId}`);
        
        const docRef = doc(db, 'productos', productoId);
        console.log(`  - Doc ref creada para: productos/${productoId}`);
        
        try {
          await updateDoc(docRef, {
            reservado: true,
            pedido_id: pedidoId
          });
          console.log(`  ✅ Firestore actualizado para ${productoId}`);
        } catch (firebaseError) {
          console.error(`  ❌ Error Firestore para ${productoId}:`, firebaseError);
          throw firebaseError;
        }
        
        // Actualizar en memoria
        const indice = productosActuales.findIndex(p => p.id === productoId);
        console.log(`  - Buscando índice en memoria para ${productoId}: ${indice}`);
        
        if (indice > -1) {
          console.log(`  ✅ Encontrado en índice ${indice}, actualizando...`);
          productosActuales[indice].reservado = true;
          productosActuales[indice].pedido_id = pedidoId;
          console.log(`    Producto actualizado:`, productosActuales[indice]);
        } else {
          console.warn(`  ⚠️ Producto ${productoId} NO ENCONTRADO en memoria`);
        }
      }
      
      // Emitir cambios sin recargar todo
      console.log('🔵 Emitiendo cambios a través de BehaviorSubject...');
      this.productos.next([...productosActuales]);
      console.log('Productos en memoria DESPUÉS:', productosActuales.length);
      console.log('✅ [MARCAR RESERVADOS] Completado exitosamente');
    } catch (error) {
      console.error('❌ [MARCAR RESERVADOS] Error:', error);
      throw error;
    }
  }

  /**
   * Desmarca productos como reservados (cuando se elimina un pedido)
   */
  async desmarcarReservados(productosIds: string[]): Promise<void> {
    try {
      const productosActuales = this.productos.value;
      
      for (const productoId of productosIds) {
        const docRef = doc(db, 'productos', productoId);
        await updateDoc(docRef, {
          reservado: false,
          pedido_id: null
        });
        
        // Actualizar en memoria
        const indice = productosActuales.findIndex(p => p.id === productoId);
        if (indice > -1) {
          productosActuales[indice].reservado = false;
          productosActuales[indice].pedido_id = undefined;
        }
      }
      
      // Emitir cambios sin recargar todo
      this.productos.next([...productosActuales]);
      console.log('Productos desmarcados como reservados en Firestore y en memoria');
    } catch (error) {
      console.error('Error desmarcando productos como reservados:', error);
      throw error;
    }
  }

  /**
   * Obtiene solo productos disponibles (no reservados)
   */
  obtenerProductosDisponibles(): Producto[] {
    return this.productos.value.filter(p => !p.reservado);
  }

  /**
   * Obtiene productos reservados
   */
  obtenerProductosReservados(): Producto[] {
    return this.productos.value.filter(p => p.reservado);
  }

  /**
   * Borra todos los productos de un álbum
   */
  async borrarAlbum(albumNombre: string): Promise<void> {
    try {
      const usuarioId = auth.currentUser?.uid;
      if (!usuarioId) {
        throw new Error('Usuario no autenticado');
      }

      // Obtener todos los productos del álbum
      const q = query(
        collection(db, 'productos'),
        where('album', '==', albumNombre)
      );

      const snapshot = await getDocs(q);
      const batch: Promise<void>[] = [];

      // Crear promesas para eliminar cada producto
      snapshot.docs.forEach(docSnapshot => {
        const docRef = doc(db, 'productos', docSnapshot.id);
        batch.push(deleteDoc(docRef));
      });

      // Ejecutar todas las eliminaciones
      await Promise.all(batch);

      console.log(`✅ Álbum "${albumNombre}" eliminado con ${snapshot.docs.length} producto(s)`);
    } catch (error) {
      console.error('Error borrando álbum:', error);
      throw error;
    }
  }

}
