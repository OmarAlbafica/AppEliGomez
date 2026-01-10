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
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Horario {
  dias: string[]; // ["Lunes", "Martes", "Viernes"]
  hora_inicio: string; // "09:00"
  hora_fin: string; // "17:00"
}

export interface DestinoEncomendista {
  nombre: string;
  horarios?: Horario[]; // Múltiples horarios
  dia?: string; // Legacy: mantener para compatibilidad
  hora_inicio?: string; // Legacy
  hora_fin?: string; // Legacy
  local?: string | null; // Lugar/dirección donde se recibe (opcional)
}

export interface Encomendista {
  id: string;
  nombre: string;
  telefono?: string | null;
  local?: string | null;
  destinos: DestinoEncomendista[]; // Destinos con horarios
  activo: boolean;
  fecha_creacion?: Date;
}

class EncomendistasService {
  /**
   * Carga todos los encomendistas activos
   */
  async cargarEncomendistas(): Promise<Encomendista[]> {
    try {
      const encomendistasRef = collection(db, 'encomendistas');
      const q = query(encomendistasRef, where('activo', '==', true));
      const snapshot = await getDocs(q);

      const encomendistas: Encomendista[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        encomendistas.push({
          id: doc.id,
          nombre: data['nombre'] || '',
          telefono: data['telefono'] || null,
          local: data['local'] || null,
          destinos: data['destinos'] || [],
          activo: data['activo'] ?? true,
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
        });
      });

      // Ordenar alfabéticamente por nombre
      encomendistas.sort((a, b) => a.nombre.localeCompare(b.nombre));
      console.log(`✅ ${encomendistas.length} encomendistas cargadas`);
      return encomendistas;
    } catch (error) {
      console.error('❌ Error cargando encomendistas:', error);
      throw error;
    }
  }

  /**
   * Carga TODAS las encomendistas incluyendo inactivas (para administración)
   */
  async cargarTodasLasEncomendistas(): Promise<Encomendista[]> {
    try {
      const encomendistasRef = collection(db, 'encomendistas');
      const snapshot = await getDocs(encomendistasRef);

      const encomendistas: Encomendista[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        encomendistas.push({
          id: doc.id,
          nombre: data['nombre'] || '',
          telefono: data['telefono'] || null,
          local: data['local'] || null,
          destinos: data['destinos'] || [],
          activo: data['activo'] ?? true,
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
        });
      });

      return encomendistas;
    } catch (error) {
      console.error('❌ Error cargando todas las encomendistas:', error);
      throw error;
    }
  }

  /**
   * Obtiene un encomendista por ID
   */
  async obtenerEncomendista(id: string): Promise<Encomendista | null> {
    try {
      const encomendistasRef = collection(db, 'encomendistas');
      const q = query(encomendistasRef, where('id', '==', id));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        nombre: data['nombre'] || '',
        telefono: data['telefono'] || null,
        local: data['local'] || null,
        destinos: data['destinos'] || [],
        activo: data['activo'] ?? true,
        fecha_creacion: data['fecha_creacion']
          ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
          : new Date(),
      };
    } catch (error) {
      console.error('❌ Error obteniendo encomendista:', error);
      return null;
    }
  }

  /**
   * Crea un nuevo encomendista
   */
  async crearEncomendista(
    nombre: string,
    destinos?: DestinoEncomendista[] | string[],
    telefono?: string,
    local?: string
  ): Promise<string> {
    try {
      if (!nombre.trim()) throw new Error('El nombre es obligatorio');

      const encomendistasRef = collection(db, 'encomendistas');

      // Convertir array de strings a DestinoEncomendista si es necesario
      let destinosFormateados: DestinoEncomendista[] = [];
      if (destinos && Array.isArray(destinos)) {
        destinosFormateados = destinos.map((d) =>
          typeof d === 'string'
            ? { nombre: d, horarios: [] }
            : d
        );
      }

      const docRef = await addDoc(encomendistasRef, {
        nombre: nombre.trim(),
        telefono: telefono?.trim() || null,
        local: local?.trim() || null,
        destinos: destinosFormateados,
        activo: true,
        fecha_creacion: Timestamp.now(),
      });

      console.log(`✅ Encomendista creada: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creando encomendista:', error);
      throw error;
    }
  }

  /**
   * Actualiza un encomendista
   */
  async actualizarEncomendista(
    id: string,
    datos: Partial<Encomendista>
  ): Promise<void> {
    try {
      const encomendistRef = doc(db, 'encomendistas', id);
      const actualizacion: any = { ...datos };

      // Remover campos que no se deben actualizar
      delete actualizacion.id;
      delete actualizacion.fecha_creacion;

      await updateDoc(encomendistRef, actualizacion);
      console.log(`✅ Encomendista actualizada: ${id}`);
    } catch (error) {
      console.error('❌ Error actualizando encomendista:', error);
      throw error;
    }
  }

  /**
   * Elimina un encomendista
   */
  async eliminarEncomendista(id: string): Promise<void> {
    try {
      const encomendistRef = doc(db, 'encomendistas', id);
      await deleteDoc(encomendistRef);
      console.log(`✅ Encomendista eliminada: ${id}`);
    } catch (error) {
      console.error('❌ Error eliminando encomendista:', error);
      throw error;
    }
  }

  /**
   * Desactiva un encomendista (soft delete)
   */
  async desactivarEncomendista(id: string): Promise<void> {
    try {
      await this.actualizarEncomendista(id, { activo: false });
      console.log(`✅ Encomendista desactivada: ${id}`);
    } catch (error) {
      console.error('❌ Error desactivando encomendista:', error);
      throw error;
    }
  }

  /**
   * Agrega un destino a un encomendista
   */
  async agregarDestino(
    encomendistId: string,
    nombre: string,
    local?: string
  ): Promise<void> {
    try {
      const encomendistRef = doc(db, 'encomendistas', encomendistId);
      const nuevoDestino: DestinoEncomendista = {
        nombre: nombre.trim(),
        horarios: [],
        local: local?.trim() || null,
      };

      await updateDoc(encomendistRef, {
        destinos: arrayUnion(nuevoDestino),
      });

      console.log(`✅ Destino agregado a encomendista: ${nombre}`);
    } catch (error) {
      console.error('❌ Error agregando destino:', error);
      throw error;
    }
  }

  /**
   * Agrega un horario a un destino
   */
  async agregarHorarioADestino(
    encomendistId: string,
    nombreDestino: string,
    dias: string[],
    hora_inicio: string,
    hora_fin: string
  ): Promise<void> {
    try {
      const encomendista = await this.obtenerEncomendista(encomendistId);
      if (!encomendista) throw new Error('Encomendista no encontrada');

      const destinoIndex = encomendista.destinos.findIndex(
        (d) => d.nombre === nombreDestino
      );
      if (destinoIndex === -1) throw new Error('Destino no encontrado');

      const destino = encomendista.destinos[destinoIndex];
      const horarios = destino.horarios || [];

      const nuevoHorario: Horario = {
        dias,
        hora_inicio,
        hora_fin,
      };

      horarios.push(nuevoHorario);

      // Actualizar el array completo de destinos
      const destinosActualizados = [...encomendista.destinos];
      destinosActualizados[destinoIndex] = { ...destino, horarios };

      const encomendistRef = doc(db, 'encomendistas', encomendistId);
      await updateDoc(encomendistRef, {
        destinos: destinosActualizados,
      });

      console.log(`✅ Horario agregado a destino: ${nombreDestino}`);
    } catch (error) {
      console.error('❌ Error agregando horario:', error);
      throw error;
    }
  }

  /**
   * Elimina un horario de un destino
   */
  async eliminarHorarioDeDestino(
    encomendistId: string,
    nombreDestino: string,
    indiceHorario: number
  ): Promise<void> {
    try {
      const encomendista = await this.obtenerEncomendista(encomendistId);
      if (!encomendista) throw new Error('Encomendista no encontrada');

      const destinoIndex = encomendista.destinos.findIndex(
        (d) => d.nombre === nombreDestino
      );
      if (destinoIndex === -1) throw new Error('Destino no encontrado');

      const destino = encomendista.destinos[destinoIndex];
      const horarios = destino.horarios || [];

      // Remover el horario por índice
      horarios.splice(indiceHorario, 1);

      // Actualizar el array completo de destinos
      const destinosActualizados = [...encomendista.destinos];
      destinosActualizados[destinoIndex] = { ...destino, horarios };

      const encomendistRef = doc(db, 'encomendistas', encomendistId);
      await updateDoc(encomendistRef, {
        destinos: destinosActualizados,
      });

      console.log(`✅ Horario eliminado de destino: ${nombreDestino}`);
    } catch (error) {
      console.error('❌ Error eliminando horario:', error);
      throw error;
    }
  }

  /**
   * Elimina un destino completo
   */
  async eliminarDestino(
    encomendistId: string,
    nombreDestino: string
  ): Promise<void> {
    try {
      const encomendista = await this.obtenerEncomendista(encomendistId);
      if (!encomendista) throw new Error('Encomendista no encontrada');

      const destinosActualizados = encomendista.destinos.filter(
        (d) => d.nombre !== nombreDestino
      );

      const encomendistRef = doc(db, 'encomendistas', encomendistId);
      await updateDoc(encomendistRef, {
        destinos: destinosActualizados,
      });

      console.log(`✅ Destino eliminado: ${nombreDestino}`);
    } catch (error) {
      console.error('❌ Error eliminando destino:', error);
      throw error;
    }
  }
}

export default new EncomendistasService();

// Mantener export por compatibilidad con código antiguo
export const encomendistasService = {
  async crearEncomendista(nombre: string, telefono: string): Promise<{ success: boolean; id?: string }> {
    try {
      const docRef = await addDoc(collection(db, 'encomendistas'), {
        nombre,
        telefono,
        destinos: [],
        activo: true,
        fecha_creacion: new Date().toISOString()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creando encomendista:', error);
      return { success: false };
    }
  },

  async obtenerEncomendistas(): Promise<Encomendista[]> {
    try {
      const q = query(collection(db, 'encomendistas'), where('activo', '==', true));
      const querySnapshot = await getDocs(q);
      const encomendistas: Encomendista[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        encomendistas.push({
          id: doc.id,
          nombre: data['nombre'] || '',
          telefono: data['telefono'] || null,
          local: data['local'] || null,
          destinos: data['destinos'] || [],
          activo: data['activo'] ?? true,
        } as Encomendista);
      });

      return encomendistas;
    } catch (error) {
      console.error('Error obteniendo encomendistas:', error);
      return [];
    }
  },

  async agregarDestino(encomendista_id: string, destino: any): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'encomendistas', encomendista_id), {
        destinos: arrayUnion(destino)
      });
      return true;
    } catch (error) {
      console.error('Error agregando destino:', error);
      return false;
    }
  },

  async actualizarEncomendista(encomendista_id: string, datos: Partial<Encomendista>): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'encomendistas', encomendista_id), datos);
      return true;
    } catch (error) {
      console.error('Error actualizando encomendista:', error);
      return false;
    }
  },

  async eliminarEncomendista(encomendista_id: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'encomendistas', encomendista_id), {
        activo: false
      });
      return true;
    } catch (error) {
      console.error('Error eliminando encomendista:', error);
      return false;
    }
  }
};
