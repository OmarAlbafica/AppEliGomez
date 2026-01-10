import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Producto {
  id: string;
  usuario_id?: string;
  nombre?: string;
  descripcion?: string;
  imagen_url?: string;
  url_imagen?: string;
  precio?: number;
  activo?: boolean;
  codigo?: string;
  album?: string;
  numero?: number;
  url_thumbnail?: string;
  tamaño_original?: number;
  tamaño_comprimido?: number;
  reservado?: boolean;
  pedido_id?: string;
  fecha_creacion?: Date;
  fecha_carga?: Date;
}

class ProductosService {
  /**
   * Carga todos los productos del usuario actual
   */
  async cargarProductos(): Promise<Producto[]> {
    try {
      console.log('🔍 [ProductosService] Iniciando cargarProductos...');
      
      const usuarioId = auth.currentUser?.uid;
      console.log('👤 [ProductosService] Usuario autenticado:', usuarioId ? 'SÍ' : 'NO');
      
      if (!usuarioId) {
        console.warn('⚠️ No hay usuario autenticado para cargar productos');
        return [];
      }

      console.log('📂 [ProductosService] Accediendo a colección "productos" en Firestore...');
      const productosRef = collection(db, 'productos');
      
      console.log('🔎 [ProductosService] Creando query sin filtros para traer TODOS los productos...');
      const q = query(productosRef);
      
      console.log('📡 [ProductosService] Ejecutando getDocs desde Firebase...');
      const snapshot = await getDocs(q);
      console.log(`📊 [ProductosService] Documentos recibidos: ${snapshot.size}`);
      
      const productos: Producto[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`📄 [ProductosService] Procesando documento: ${doc.id}`, data);
        productos.push({
          id: doc.id,
          usuario_id: data['usuario_id'],
          nombre: data['nombre'] || data['codigo'] || 'Producto sin nombre',
          descripcion: data['descripcion'] || undefined,
          imagen_url: data['imagen_url'] || data['url_imagen'] || undefined,
          url_imagen: data['url_imagen'] || undefined,
          precio: data['precio'] || undefined,
          activo: data['activo'] ?? true,
          codigo: data['codigo'],
          album: data['album'],
          numero: data['numero'],
          url_thumbnail: data['url_thumbnail'],
          tamaño_original: data['tamaño_original'],
          tamaño_comprimido: data['tamaño_comprimido'],
          reservado: data['reservado'] ?? false,
          pedido_id: data['pedido_id'],
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
          fecha_carga: data['fecha_carga']
            ? new Date(data['fecha_carga'].toDate?.() || data['fecha_carga'])
            : new Date(),
        });
      });

      console.log(`✅ [ProductosService] Total productos cargados: ${productos.length}`, productos);
      return productos;
    } catch (error) {
      console.error('❌ [ProductosService] Error cargando productos:', error);
      throw error;
    }
  }

  /**
   * Obtiene un producto por ID
   */
  async obtenerProducto(id: string): Promise<Producto | null> {
    try {
      const productosRef = collection(db, 'productos');
      const q = query(productosRef, where('id', '==', id));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        nombre: data['nombre'] || '',
        descripcion: data['descripcion'] || undefined,
        imagen_url: data['imagen_url'] || undefined,
        precio: data['precio'] || undefined,
        activo: data['activo'] ?? true,
        fecha_creacion: data['fecha_creacion']
          ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
          : new Date(),
      };
    } catch (error) {
      console.error('❌ Error obteniendo producto:', error);
      return null;
    }
  }

  /**
   * Crea un nuevo producto
   */
  async crearProducto(
    nombre: string,
    descripcion?: string,
    imagen_url?: string,
    precio?: number
  ): Promise<string> {
    try {
      const usuarioId = auth.currentUser?.uid;
      if (!usuarioId) throw new Error('No hay usuario autenticado');

      const productosRef = collection(db, 'productos');
      const docRef = await addDoc(productosRef, {
        usuario_id: usuarioId,
        nombre,
        descripcion: descripcion || null,
        imagen_url: imagen_url || null,
        precio: precio || null,
        activo: true,
        fecha_creacion: Timestamp.now(),
      });

      console.log(`✅ Producto creado: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creando producto:', error);
      throw error;
    }
  }

  /**
   * Actualiza un producto
   */
  async actualizarProducto(
    id: string,
    datos: Partial<Producto>
  ): Promise<void> {
    try {
      const productRef = doc(db, 'productos', id);
      const actualizacion: any = { ...datos };
      
      // Remover id de la actualización
      delete actualizacion.id;
      
      // Si hay fecha_creacion como Date, convertir a Timestamp
      if (actualizacion.fecha_creacion instanceof Date) {
        actualizacion.fecha_creacion = Timestamp.fromDate(actualizacion.fecha_creacion);
      }

      await updateDoc(productRef, actualizacion);
      console.log(`✅ Producto actualizado: ${id}`);
    } catch (error) {
      console.error('❌ Error actualizando producto:', error);
      throw error;
    }
  }

  /**
   * Elimina un producto
   */
  async eliminarProducto(id: string): Promise<void> {
    try {
      const productRef = doc(db, 'productos', id);
      await deleteDoc(productRef);
      console.log(`✅ Producto eliminado: ${id}`);
    } catch (error) {
      console.error('❌ Error eliminando producto:', error);
      throw error;
    }
  }

  /**
   * Marca un producto como inactivo (soft delete)
   */
  async desactivarProducto(id: string): Promise<void> {
    try {
      await this.actualizarProducto(id, { activo: false });
      console.log(`✅ Producto desactivado: ${id}`);
    } catch (error) {
      console.error('❌ Error desactivando producto:', error);
      throw error;
    }
  }

  /**
   * Busca productos por nombre (insensible a acentos)
   */
  buscarProductos(productos: Producto[], termino: string): Producto[] {
    if (!termino.trim()) return productos;

    const terminoNormalizado = this.normalizarTexto(termino);
    return productos.filter(p =>
      this.normalizarTexto(p.nombre || '').includes(terminoNormalizado)
    );
  }

  /**
   * Marca productos como reservados en Firestore
   */
  async marcarComoReservados(productosIds: any[], pedidoId: string): Promise<void> {
    try {
      console.log('🔴 [MARCAR RESERVADOS] Marcando productos como reservados...');
      console.log('IDs a marcar:', productosIds);
      console.log('Pedido ID:', pedidoId);

      // Manejar tanto strings simples como objetos {id, cantidad}
      const idsLimpios = productosIds.map(p => typeof p === 'string' ? p : p.id);
      console.log('IDs limpios:', idsLimpios);

      for (const productoId of idsLimpios) {
        const docRef = doc(db, 'productos', productoId);
        await updateDoc(docRef, {
          reservado: true,
          pedido_id: pedidoId,
        });
        console.log(`✅ Producto ${productoId} marcado como reservado con pedido_id: ${pedidoId}`);
      }

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
      console.log('🟢 [DESMARCAR RESERVADOS] Desmarcando productos...');

      for (const productoId of productosIds) {
        const docRef = doc(db, 'productos', productoId);
        await updateDoc(docRef, {
          reservado: false,
        });
      }

      console.log('✅ Productos desmarcados como reservados en Firestore');
    } catch (error) {
      console.error('Error desmarcando productos como reservados:', error);
      throw error;
    }
  }

  /**
   * LIMPIEZA: Elimina los 4 productos de ejemplo que se crearon antes
   */
  async eliminarProductosEjemplo(): Promise<void> {
    try {
      console.log('🗑️ [LIMPIEZA] Eliminando productos de ejemplo...');
      
      const productosParaEliminar = ['3NTtLxnHt3CpHf9m1tle', 'E0lnwmg4ny7RRU2oMFVD', 'grkuSy797GSHehaINayr', 'oSaRzxtKyzHA6AKoxDx9'];
      
      for (const id of productosParaEliminar) {
        try {
          const docRef = doc(db, 'productos', id);
          await deleteDoc(docRef);
          console.log(`✅ Eliminado: ${id}`);
        } catch (e) {
          console.warn(`⚠️ No se pudo eliminar ${id}:`, e);
        }
      }
      
      console.log('🗑️ LIMPIEZA COMPLETADA');
    } catch (error) {
      console.error('❌ Error en limpieza:', error);
    }
  }

  /**
   * Normaliza texto: quita acentos y convierte a minúsculas
   */
  private normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}

export default new ProductosService();
