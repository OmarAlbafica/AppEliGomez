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

export interface Tienda {
  id: string;
  usuario_id: string;
  nombre_pagina: string;
  nombre_perfil_reserva: string;
  instagram?: string;
  activo: boolean;
  fecha_creacion: Date;
}

class TiendasService {
  /**
   * Carga todas las tiendas disponibles
   */
  async cargarTiendas(): Promise<Tienda[]> {
    try {
      const tiendasRef = collection(db, 'tiendas');
      // Sin filtros - carga todas las tiendas
      const q = query(tiendasRef);

      const snapshot = await getDocs(q);
      const tiendas: Tienda[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        tiendas.push({
          id: doc.id,
          usuario_id: data['usuario_id'] || '',
          nombre_pagina: data['nombre_pagina'] || '',
          nombre_perfil_reserva: data['nombre_perfil_reserva'] || '',
          instagram: data['instagram'] || undefined,
          activo: data['activo'] ?? true,
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
        });
      });

      console.log(`✅ [tiendasService] ${tiendas.length} tiendas cargadas`);
      return tiendas;
    } catch (error) {
      console.error('❌ [tiendasService] Error cargando tiendas:', error);
      throw error;
    }
  }

  /**
   * Obtiene una tienda por ID
   */
  async obtenerTienda(id: string): Promise<Tienda | null> {
    try {
      const tiendasRef = collection(db, 'tiendas');
      const q = query(tiendasRef, where('id', '==', id));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        usuario_id: data['usuario_id'] || '',
        nombre_pagina: data['nombre_pagina'] || '',
        nombre_perfil_reserva: data['nombre_perfil_reserva'] || '',
        instagram: data['instagram'] || undefined,
        activo: data['activo'] ?? true,
        fecha_creacion: data['fecha_creacion']
          ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
          : new Date(),
      };
    } catch (error) {
      console.error('❌ Error obteniendo tienda:', error);
      return null;
    }
  }

  /**
   * Crea una nueva tienda para el usuario actual
   */
  async crearTienda(
    nombre_pagina: string,
    nombre_perfil_reserva: string,
    instagram?: string
  ): Promise<string> {
    try {
      const usuarioId = auth.currentUser?.uid;
      if (!usuarioId) throw new Error('No hay usuario autenticado');

      if (!nombre_pagina.trim()) {
        throw new Error('El nombre de la página es obligatorio');
      }
      if (!nombre_perfil_reserva.trim()) {
        throw new Error('El nombre del perfil de reserva es obligatorio');
      }

      const tiendasRef = collection(db, 'tiendas');
      const docRef = await addDoc(tiendasRef, {
        usuario_id: usuarioId,
        nombre_pagina: nombre_pagina.trim(),
        nombre_perfil_reserva: nombre_perfil_reserva.trim(),
        instagram: instagram?.trim() || null,
        activo: true,
        fecha_creacion: Timestamp.now(),
      });

      console.log(`✅ Tienda creada: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creando tienda:', error);
      throw error;
    }
  }

  /**
   * Actualiza una tienda
   */
  async actualizarTienda(id: string, datos: Partial<Tienda>): Promise<void> {
    try {
      const tiendaRef = doc(db, 'tiendas', id);
      const actualizacion: any = { ...datos };

      // Remover campos que no se deben actualizar
      delete actualizacion.id;
      delete actualizacion.usuario_id;
      delete actualizacion.fecha_creacion;

      // Si hay fecha como Date, convertir a Timestamp
      if (actualizacion.fecha_creacion instanceof Date) {
        actualizacion.fecha_creacion = Timestamp.fromDate(actualizacion.fecha_creacion);
      }

      await updateDoc(tiendaRef, actualizacion);
      console.log(`✅ Tienda actualizada: ${id}`);
    } catch (error) {
      console.error('❌ Error actualizando tienda:', error);
      throw error;
    }
  }

  /**
   * Elimina una tienda
   */
  async eliminarTienda(id: string): Promise<void> {
    try {
      const tiendaRef = doc(db, 'tiendas', id);
      await deleteDoc(tiendaRef);
      console.log(`✅ Tienda eliminada: ${id}`);
    } catch (error) {
      console.error('❌ Error eliminando tienda:', error);
      throw error;
    }
  }

  /**
   * Desactiva una tienda (soft delete)
   */
  async desactivarTienda(id: string): Promise<void> {
    try {
      await this.actualizarTienda(id, { activo: false });
      console.log(`✅ Tienda desactivada: ${id}`);
    } catch (error) {
      console.error('❌ Error desactivando tienda:', error);
      throw error;
    }
  }
}

export default new TiendasService();
