import { db } from './firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where
} from 'firebase/firestore';

export interface Cliente {
  id?: string;
  nombre: string;
  telefono: string;
  correo?: string;
  direccion?: string;
  activo: boolean;
  fecha_creacion: string;
}

export const clientesService = {
  async crearCliente(nombre: string, telefono: string, correo?: string, direccion?: string): Promise<{ success: boolean; id?: string }> {
    try {
      const docRef = await addDoc(collection(db, 'clientes'), {
        nombre,
        telefono,
        correo: correo || '',
        direccion: direccion || '',
        activo: true,
        fecha_creacion: new Date().toISOString()
      });
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error creando cliente:', error);
      return { success: false };
    }
  },

  async obtenerClientes(): Promise<Cliente[]> {
    try {
      const q = query(collection(db, 'clientes'), where('activo', '==', true));
      const querySnapshot = await getDocs(q);
      const clientes: Cliente[] = [];
      
      querySnapshot.forEach((doc) => {
        clientes.push({ id: doc.id, ...doc.data() } as Cliente);
      });
      
      return clientes;
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      return [];
    }
  },

  async actualizarCliente(cliente_id: string, datos: Partial<Cliente>): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'clientes', cliente_id), datos);
      return true;
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      return false;
    }
  },

  async eliminarCliente(cliente_id: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'clientes', cliente_id), {
        activo: false
      });
      return true;
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      return false;
    }
  }
};
