import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, storage } from '../../environments/firebase.config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ProductosService } from '../productos/productos.service';

export interface Pedido {
  id: string;
  usuario_id: string;
  cliente_id: string;                     // Referencia al cliente
  telefono_cliente?: string;              // NUEVO: Teléfono del cliente
  tienda_id?: string;                     // ID de la tienda
  nombre_perfil?: string;                 // NUEVO: Nombre del perfil (ej: "eli 1", "bettys")
  nombre_tienda?: string;                 // NUEVO: Nombre de la tienda (ej: "ELI GOMEZ", "BETTYS")
  logo_tienda?: string;                   // NUEVO: URL del logo de la tienda
  color_sticker?: string;                 // NUEVO: Color del sticker (ej: #FF6B6B)
  whatsapp_tienda?: string;               // NUEVO: WhatsApp de la tienda
  pagina_web_tienda?: string;             // NUEVO: Página web de la tienda
  destino_id?: string;                    // Referencia al destino del encomendista (modo normal)
  encomendista_id?: string;               // ID del encomendista responsable (modo normal)
  direccion_personalizada?: string;       // Dirección personalizada (modo personalizado)
  cantidad_prendas: number;               // Cantidad de prendas
  costo_prendas?: number;                 // Costo del producto/prenda
  monto_envio: number;                    // Costo del envío
  total?: number;                         // Total del pedido (prendas + envío)
  dia_entrega: string;                    // Día de entrega (Lunes, Martes, etc.)
  hora_inicio?: string;                   // Hora de inicio de entrega
  hora_fin?: string;                      // Hora de fin de entrega
  modo?: 'normal' | 'personalizado';      // Tipo de pedido
  notas?: string;                         // Notas adicionales
  productos_id?: string[];                // IDs de productos seleccionados para este pedido
  productos_codigos?: string[];           // Códigos de los productos para referencia rápida
  estado: 'pendiente' | 'empacada' | 'enviado' | 'retirado' | 'no-retirado' | 'cancelado' | 'retirado-local' | 'liberado' | 'reservado';
  codigo_pedido?: string;                 // Código único del pedido (ej: E202501051)
  foto_paquete?: string;                  // URL de la foto del paquete empacado
  fecha_creacion: Date;
  fecha_entrega_programada?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class PedidosService {
  private pedidos = new BehaviorSubject<Pedido[]>([]);
  public pedidos$ = this.pedidos.asObservable();

  constructor(private productosService: ProductosService) {
    // No cargar en el constructor - esperar a que el componente solicite
  }

  /**
   * Carga todos los pedidos del usuario actual
   * Si no hay pedidos cargados, recarga desde Firebase
   */
  cargarPedidos(): Observable<Pedido[]> {
    // Si no hay pedidos, cargar ahora
    if (this.pedidos.value.length === 0) {
      this.cargarPedidosInterno();
    }
    return this.pedidos$;
  }

  /**
   * Recarga los pedidos forzadamente desde Firebase
   * Intenta hasta que el usuario esté autenticado
   */
  async recargarPedidos(): Promise<void> {
    let intentos = 0;
    const maxIntentos = 10;
    
    while (intentos < maxIntentos && !auth.currentUser?.uid) {
      console.log(`Esperando autenticación... intento ${intentos + 1}/${maxIntentos}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Espera 500ms
      intentos++;
    }
    
    if (!auth.currentUser?.uid) {
      console.warn('No se pudo autenticar después de varios intentos');
      return;
    }
    
    return this.cargarPedidosInterno();
  }

  /**
   * Carga pedidos desde Firestore (interno)
   */
  private async cargarPedidosInterno() {
    try {
      console.log('Cargando pedidos');
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef);
      const snapshot = await getDocs(q);

      console.log('Documentos encontrados en pedidos:', snapshot.size);

      const pedidos: Pedido[] = [];
      snapshot.forEach(doc => {
        try {
          const docData = doc.data();
          const pedido: Pedido = {
            id: doc.id,
            usuario_id: docData['usuario_id'],
            cliente_id: docData['cliente_id'],
            tienda_id: docData['tienda_id'],
            nombre_perfil: docData['nombre_perfil'],                // NUEVO: Nombre del perfil
            nombre_tienda: docData['nombre_tienda'],                // NUEVO: Nombre de la tienda
            logo_tienda: docData['logo_tienda'],                    // NUEVO: Logo de la tienda
            color_sticker: docData['color_sticker'],                // NUEVO: Color del sticker
            whatsapp_tienda: docData['whatsapp_tienda'],            // NUEVO: WhatsApp de la tienda
            pagina_web_tienda: docData['pagina_web_tienda'],        // NUEVO: Página web de la tienda
            destino_id: docData['destino_id'],
            encomendista_id: docData['encomendista_id'],
            direccion_personalizada: docData['direccion_personalizada'],
            cantidad_prendas: docData['cantidad_prendas'],
            costo_prendas: docData['costo_prendas'],
            monto_envio: docData['monto_envio'],
            total: docData['total'],
            dia_entrega: docData['dia_entrega'],
            hora_inicio: docData['hora_inicio'] || null,
            hora_fin: docData['hora_fin'] || null,
            modo: docData['modo'],
            notas: docData['notas'] || null,
            productos_id: docData['productos_id'] || [], // IMPORTANTE: Cargar array de productos
            productos_codigos: docData['productos_codigos'] || [], // Cargar códigos de productos
            codigo_pedido: docData['codigo_pedido'], // Cargar código único del pedido
            foto_paquete: docData['foto_paquete'], // Cargar URL de foto
            estado: docData['estado'] || 'pendiente',
            fecha_creacion: typeof docData['fecha_creacion'] === 'string' 
              ? new Date(docData['fecha_creacion']) 
              : docData['fecha_creacion'].toDate?.() || new Date(),
            fecha_entrega_programada: typeof docData['fecha_entrega_programada'] === 'string'
              ? new Date(docData['fecha_entrega_programada'])
              : docData['fecha_entrega_programada']?.toDate?.() || undefined
          };
          console.log('%c✅ PEDIDO CARGADO COMPLETO:', 'color: green; font-weight: bold');
          console.log('%c  📋 Modo:', 'color: teal; font-weight: bold', pedido.modo);
          console.log('%c  🏠 Dirección:', 'color: orange; font-weight: bold', pedido.direccion_personalizada);
          console.log('%c  👤 Encomendista:', 'color: purple; font-weight: bold', pedido.encomendista_id);
          console.log('%c  🏪 Tienda:', 'color: brown; font-weight: bold', pedido.nombre_tienda);
          pedidos.push(pedido);
        } catch (docError) {
          console.error('Error procesando documento de pedido:', doc.id, docError);
        }
      });

      console.log('Pedidos procesados:', pedidos.length, pedidos);
      this.pedidos.next(pedidos.sort((a, b) => b.fecha_creacion.getTime() - a.fecha_creacion.getTime()));
    } catch (error) {
      console.error('Error cargando pedidos:', error);
    }
  }

  /**
   * Crea un nuevo pedido
   */
  async crearPedido(pedido: Omit<Pedido, 'id' | 'usuario_id' | 'fecha_creacion'>): Promise<string> {
    try {
      const usuario_id = auth.currentUser?.uid;
      if (!usuario_id) throw new Error('Usuario no autenticado');

      console.log('📦 [CREAR PEDIDO] Iniciando creación...');
      console.log('Productos ID recibidos:', pedido.productos_id);

      // Obtener códigos de los productos
      let productos_codigos: string[] = [];
      if (pedido.productos_id && pedido.productos_id.length > 0) {
        const productos = this.productosService.obtenerProductosActuales();
        console.log('Productos en servicio:', productos.length);
        
        productos_codigos = pedido.productos_id
          .map(id => {
            const producto = productos.find(p => p.id === id);
            console.log(`  Buscando código para ID ${id}:`, producto?.codigo || 'NO ENCONTRADO');
            return producto?.codigo || '';
          })
          .filter(codigo => codigo.length > 0);
        console.log('Códigos finales a guardar:', productos_codigos);
      }

      // Convertir undefined a null para Firebase
      const pedidoLimpio = Object.entries(pedido).reduce((acc: any, [key, value]) => {
        acc[key] = value === undefined ? null : value;
        return acc;
      }, {});

      console.log('Pedido limpio a guardar:', pedidoLimpio);
      console.log('Productos ID en pedido limpio:', pedidoLimpio.productos_id);
      
      // LOG DETALLADO DE CAMPOS CRÍTICOS
      console.log('%c🔍 VERIFICACIÓN DE CAMPOS CRÍTICOS', 'color: blue; font-weight: bold; font-size: 12px');
      console.log('%c📋 MODO en pedidoLimpio:', 'color: teal; font-weight: bold', pedidoLimpio.modo);
      console.log('%c🏠 DIRECCIÓN en pedidoLimpio:', 'color: orange; font-weight: bold', pedidoLimpio.direccion_personalizada);
      console.log('%c👤 ENCOMENDISTA en pedidoLimpio:', 'color: purple; font-weight: bold', pedidoLimpio.encomendista_id);
      console.log('%c🏪 TIENDA en pedidoLimpio:', 'color: brown; font-weight: bold', pedidoLimpio.nombre_tienda);

      const objetoAGuardar = {
        ...pedidoLimpio,
        productos_codigos, // Agregar códigos
        usuario_id,
        fecha_creacion: new Date().toISOString(),
        estado: 'pendiente'
      };
      
      console.log('%c💾 OBJETO FINAL A GUARDAR EN FIRESTORE:', 'color: red; font-weight: bold; font-size: 12px');
      console.log('%c📋 MODO en objeto final:', 'color: teal; font-weight: bold', objetoAGuardar.modo);
      console.log('%c🏠 DIRECCIÓN en objeto final:', 'color: orange; font-weight: bold', objetoAGuardar.direccion_personalizada);
      console.log('%c Objeto completo:', 'color: gray', objetoAGuardar);

      const docRef = await addDoc(collection(db, 'pedidos'), objetoAGuardar);

      console.log('✅ Pedido guardado con ID:', docRef.id);

      // Marcar productos como reservados
      if (pedidoLimpio.productos_id && pedidoLimpio.productos_id.length > 0) {
        console.log('🟠 Intentando marcar productos como reservados...');
        try {
          await this.productosService.marcarComoReservados(pedidoLimpio.productos_id, docRef.id);
          console.log('✅ Productos marcados como reservados');
        } catch (error) {
          console.error('❌ Error marcando productos como reservados:', error);
          // No lanzar error, el pedido ya está creado
        }
      } else {
        console.warn('⚠️ No hay productos para marcar como reservados');
      }

      await this.cargarPedidosInterno();
      console.log('✅ [CREAR PEDIDO] Completado');
      return docRef.id;
    } catch (error) {
      console.error('❌ [CREAR PEDIDO] Error:', error);
      throw error;
    }
  }

  /**
   * Genera un código único para el pedido
   * Formato: [INICIAL_CLIENTE][YYYYMMDD][SECUENCIAL]
   * Ejemplo: E202501051 (E=Eli Gomez, 20250105=fecha, 1=primer pedido)
   */

  /**
   * Actualiza un pedido
   */
  async actualizarPedido(pedido: Pedido): Promise<void> {
    try {
      const docRef = doc(db, 'pedidos', pedido.id);
      const { id, usuario_id, fecha_creacion, ...datos } = pedido;

      // Convertir undefined a null para Firebase
      const datosLimpios = Object.entries(datos).reduce((acc: any, [key, value]) => {
        acc[key] = value === undefined ? null : value;
        return acc;
      }, {});

      await updateDoc(docRef, datosLimpios);
      await this.cargarPedidosInterno();
    } catch (error) {
      console.error('Error actualizando pedido:', error);
      throw error;
    }
  }

  /**
   * Libera los productos de un pedido (cuando se marca como LIBERADO)
   * Desmarcar como reservados y cambiar estado del pedido
   */
  async liberarPedido(id: string): Promise<void> {
    try {
      console.log('🔓 [LIBERAR PEDIDO] Iniciando para pedido:', id);
      
      // Obtener el pedido actual
      const pedido = this.pedidos.value.find(p => p.id === id);
      
      if (!pedido) {
        throw new Error('Pedido no encontrado');
      }

      // Cambiar estado a "liberado"
      const docRef = doc(db, 'pedidos', id);
      await updateDoc(docRef, {
        estado: 'liberado',
        fecha_liberacion: new Date().toISOString()
      });
      console.log('✅ Pedido marcado como liberado');

      // Desmarcar productos como reservados
      if (pedido.productos_id && pedido.productos_id.length > 0) {
        try {
          await this.productosService.desmarcarReservados(pedido.productos_id);
          console.log('✅ Productos liberados/desmarcados:', pedido.productos_id);
        } catch (error) {
          console.error('⚠️ Error liberando productos:', error);
          // No lanzar error, el pedido ya fue marcado como liberado
        }
      }

      await this.cargarPedidosInterno();
      console.log('✅ [LIBERAR PEDIDO] Completado');
    } catch (error) {
      console.error('❌ [LIBERAR PEDIDO] Error:', error);
      throw error;
    }
  }

  /**
   * Elimina un pedido
   */
  async eliminarPedido(id: string): Promise<void> {
    try {
      // Obtener el pedido antes de eliminarlo para desmarcar productos
      const pedido = this.pedidos.value.find(p => p.id === id);
      
      const docRef = doc(db, 'pedidos', id);
      await deleteDoc(docRef);

      // Desmarcar productos como reservados
      if (pedido && pedido.productos_id && pedido.productos_id.length > 0) {
        try {
          await this.productosService.desmarcarReservados(pedido.productos_id);
          console.log('Productos desmarcados como reservados:', pedido.productos_id);
        } catch (error) {
          console.error('Error desmarcando productos:', error);
          // No lanzar error, el pedido ya fue eliminado
        }
      }

      await this.cargarPedidosInterno();
    } catch (error) {
      console.error('Error eliminando pedido:', error);
      throw error;
    }
  }

  /**
   * Sube la foto del paquete empacado a Firebase Storage
   * Retorna la URL descargable de la imagen
   */
  async subirFotoPaquete(pedidoId: string, archivo: File): Promise<string> {
    try {
      const usuario_id = auth.currentUser?.uid;
      if (!usuario_id) throw new Error('Usuario no autenticado');

      // Crear ruta: pedidos/{usuario_id}/{pedidoId}/paquete_{timestamp}
      const timestamp = Date.now();
      const extension = archivo.name.split('.').pop() || 'jpg';
      const rutaStorage = `pedidos/${usuario_id}/${pedidoId}/paquete_${timestamp}.${extension}`;

      console.log(`📸 Subiendo foto a: ${rutaStorage}`);

      // Crear referencia de almacenamiento
      const storageRef = ref(storage, rutaStorage);

      // Subir el archivo
      const snapshot = await uploadBytes(storageRef, archivo);
      console.log('✅ Archivo subido:', snapshot.ref.fullPath);

      // Obtener URL descargable
      const urlDescargable = await getDownloadURL(snapshot.ref);
      console.log('✅ URL obtenida:', urlDescargable);

      return urlDescargable;
    } catch (error) {
      console.error('❌ Error subiendo foto del paquete:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los pedidos creados en un día específico
   * Utilizado para generar códigos únicos secuenciales por día
   */
  async obtenerPedidosDelDia(fecha: Date): Promise<Pedido[]> {
    try {
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef);
      const snapshot = await getDocs(q);

      // Filtrar pedidos del mismo día
      const pedidosDelDia = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Pedido))
        .filter(pedido => {
          const fechaCreacion = pedido.fecha_creacion instanceof Date 
            ? pedido.fecha_creacion 
            : new Date(pedido.fecha_creacion);
          
          return fechaCreacion.toDateString() === fecha.toDateString();
        });

      return pedidosDelDia;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos del día:', error);
      return [];
    }
  }
}
