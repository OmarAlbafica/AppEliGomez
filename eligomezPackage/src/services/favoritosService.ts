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
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FavoritoPedido {
  id?: string;
  usuario_id: string;
  cliente_id: string;
  cliente_nombre: string;
  encomendista_id: string;
  encomendista_nombre: string;
  modo: 'normal' | 'personalizado';
  descripcion: string;
  destino_id?: string;
  destino_nombre?: string;
  direccion_personalizada?: string;
  dia_maximo: string;
  activo: boolean;
  fecha_creacion: Date;
}

class FavoritosService {
  private STORAGE_KEY = 'favoritos_pendientes';

  /**
   * Carga todos los favoritos del usuario actual
   */
  async cargarFavoritos(): Promise<FavoritoPedido[]> {
    try {
      const usuarioId = auth.currentUser?.uid;
      if (!usuarioId) {
        console.warn('⚠️ No hay usuario autenticado para cargar favoritos');
        return [];
      }

      const favoritosRef = collection(db, 'favoritos_pedidos');
      const q = query(
        favoritosRef,
        where('usuario_id', '==', usuarioId),
        where('activo', '==', true)
      );

      const snapshot = await getDocs(q);
      const favoritos: FavoritoPedido[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        favoritos.push({
          id: doc.id,
          usuario_id: data['usuario_id'] || usuarioId,
          cliente_id: data['cliente_id'] || '',
          cliente_nombre: data['cliente_nombre'] || '',
          encomendista_id: data['encomendista_id'] || '',
          encomendista_nombre: data['encomendista_nombre'] || '',
          modo: data['modo'] || 'normal',
          descripcion: data['descripcion'] || '',
          destino_id: data['destino_id'] || undefined,
          destino_nombre: data['destino_nombre'] || undefined,
          direccion_personalizada: data['direccion_personalizada'] || undefined,
          dia_maximo: data['dia_maximo'] || '',
          activo: data['activo'] ?? true,
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
        });
      });

      console.log(`✅ ${favoritos.length} favoritos cargados`);
      return favoritos;
    } catch (error) {
      console.error('❌ Error cargando favoritos:', error);
      throw error;
    }
  }

  /**
   * Carga favoritos filtrados por cliente (sin filtro de usuario)
   */
  async obtenerFavoritosPorCliente(clienteId: string): Promise<FavoritoPedido[]> {
    try {
      console.log('🔍 [FavoritosService] Buscando favoritos para cliente:', clienteId);
      
      const favoritosRef = collection(db, 'favoritos_pedidos');
      
      // Solo filtrar por cliente_id, sin usuario_id
      const q = query(
        favoritosRef,
        where('cliente_id', '==', clienteId)
      );

      const snapshot = await getDocs(q);
      console.log(`📊 [FavoritosService] Favoritos encontrados: ${snapshot.size}`);
      
      const favoritos: FavoritoPedido[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        favoritos.push({
          id: doc.id,
          usuario_id: data['usuario_id'] || '',
          cliente_id: data['cliente_id'] || '',
          cliente_nombre: data['cliente_nombre'] || '',
          encomendista_id: data['encomendista_id'] || '',
          encomendista_nombre: data['encomendista_nombre'] || '',
          modo: data['modo'] || 'normal',
          descripcion: data['descripcion'] || '',
          destino_id: data['destino_id'] || undefined,
          destino_nombre: data['destino_nombre'] || undefined,
          direccion_personalizada: data['direccion_personalizada'] || undefined,
          dia_maximo: data['dia_maximo'] || '',
          activo: data['activo'] ?? true,
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
        });
      });

      console.log(`✅ [FavoritosService] Total favoritos para cliente ${clienteId}: ${favoritos.length}`);
      return favoritos;
    } catch (error) {
      console.error('❌ [FavoritosService] Error obteniendo favoritos por cliente:', error);
      return [];
    }
  }

  /**
   * Crea un nuevo favorito de pedido
   */
  async crearFavorito(favorito: FavoritoPedido): Promise<string> {
    try {
      const usuarioId = auth.currentUser?.uid;
      if (!usuarioId) throw new Error('No hay usuario autenticado');

      if (!favorito.cliente_id) throw new Error('cliente_id es requerido');
      if (!favorito.encomendista_id) throw new Error('encomendista_id es requerido');
      if (!favorito.descripcion.trim()) throw new Error('descripcion es requerida');
      if (!favorito.dia_maximo.trim()) throw new Error('dia_maximo es requerido');

      const favoritosRef = collection(db, 'favoritos_pedidos');
      const docRef = await addDoc(favoritosRef, {
        usuario_id: usuarioId,
        cliente_id: favorito.cliente_id,
        cliente_nombre: favorito.cliente_nombre || '',
        encomendista_id: favorito.encomendista_id,
        encomendista_nombre: favorito.encomendista_nombre || '',
        modo: favorito.modo,
        descripcion: favorito.descripcion.trim(),
        destino_id: favorito.destino_id || null,
        destino_nombre: favorito.destino_nombre || null,
        direccion_personalizada: favorito.direccion_personalizada || null,
        dia_maximo: favorito.dia_maximo,
        activo: true,
        fecha_creacion: Timestamp.now(),
      });

      console.log(`⭐ Favorito creado: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creando favorito:', error);
      throw error;
    }
  }

  /**
   * Actualiza un favorito existente
   */
  async actualizarFavorito(id: string, datos: Partial<FavoritoPedido>): Promise<void> {
    try {
      const favoritoRef = doc(db, 'favoritos_pedidos', id);
      const actualizacion: any = { ...datos };

      // Remover campos que no se deben actualizar
      delete actualizacion.id;
      delete actualizacion.usuario_id;
      delete actualizacion.cliente_id;
      delete actualizacion.encomendista_id;
      delete actualizacion.fecha_creacion;

      await updateDoc(favoritoRef, actualizacion);
      console.log(`⭐ Favorito actualizado: ${id}`);
    } catch (error) {
      console.error('❌ Error actualizando favorito:', error);
      throw error;
    }
  }

  /**
   * Elimina un favorito
   */
  async eliminarFavorito(id: string): Promise<void> {
    try {
      const favoritoRef = doc(db, 'favoritos_pedidos', id);
      await deleteDoc(favoritoRef);
      console.log(`⭐ Favorito eliminado: ${id}`);
    } catch (error) {
      console.error('❌ Error eliminando favorito:', error);
      throw error;
    }
  }

  /**
   * Desactiva un favorito (soft delete)
   */
  async desactivarFavorito(id: string): Promise<void> {
    try {
      await this.actualizarFavorito(id, { activo: false });
      console.log(`⭐ Favorito desactivado: ${id}`);
    } catch (error) {
      console.error('❌ Error desactivando favorito:', error);
      throw error;
    }
  }

  /**
   * Migra favoritos desde localStorage a Firebase
   * Evita duplicados
   */
  async migrarFavoritosLocalStorageAFirebase(): Promise<{
    migrados: number;
    duplicados: number;
  }> {
    try {
      const datosLocales = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!datosLocales) {
        console.log('📊 No hay favoritos en AsyncStorage para migrar');
        return { migrados: 0, duplicados: 0 };
      }

      const favoritosLocales: FavoritoPedido[] = JSON.parse(datosLocales);
      const favoritosActuales = await this.cargarFavoritos();

      let migrados = 0;
      let duplicados = 0;

      for (const favorito of favoritosLocales) {
        // Verificar si ya existe
        const existe = favoritosActuales.some(
          (f) =>
            f.cliente_id === favorito.cliente_id &&
            f.encomendista_id === favorito.encomendista_id &&
            f.modo === favorito.modo &&
            f.descripcion === favorito.descripcion
        );

        if (!existe) {
          await this.crearFavorito(favorito);
          migrados++;
        } else {
          duplicados++;
        }
      }

      // Limpiar localStorage después de migrar
      if (migrados > 0) {
        await AsyncStorage.removeItem(this.STORAGE_KEY);
      }

      console.log(`📊 Migración completada: ${migrados} migrados, ${duplicados} duplicados`);
      return { migrados, duplicados };
    } catch (error) {
      console.error('❌ Error en migración de favoritos:', error);
      return { migrados: 0, duplicados: 0 };
    }
  }
}

export default new FavoritosService();
