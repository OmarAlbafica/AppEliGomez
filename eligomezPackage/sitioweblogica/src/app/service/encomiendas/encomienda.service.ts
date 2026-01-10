import { Injectable } from '@angular/core';
import { collection, addDoc, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../environments/firebase.config';

export interface PrecioEncomienda {
  tipo: 'por_prenda' | 'monto_fijo';
  valor: number; // Si por_prenda: $1, si monto_fijo: $3
  cantidad_prendas?: number; // Cantidad de prendas si es por_prenda
  total?: number; // Total calculado
}

export interface Encomienda {
  id: string;
  usuario_id: string;
  nombre: string;
  telefono?: string;
  local?: string;
  encomendista_id: string;
  estado: 'pendiente' | 'confirmada' | 'entregada' | 'cancelada';
  fecha_creacion: Date;
}

@Injectable({
  providedIn: 'root'
})
export class EncomiendaService {

  constructor() {}

  /**
   * Crea una nueva encomienda
   */
  async crearEncomienda(
    encomendista_id: string,
    nombre: string,
    telefono?: string,
    local?: string
  ): Promise<string> {
    try {
      const usuario_id = auth.currentUser?.uid;
      if (!usuario_id) {
        throw new Error('Usuario no autenticado');
      }

      const data: any = {
        usuario_id,
        encomendista_id,
        nombre,
        estado: 'pendiente',
        fecha_creacion: new Date().toISOString()
      };
      
      // Solo agregar campos opcionales si tienen valor
      if (telefono) data.telefono = telefono;
      if (local) data.local = local;

      const docRef = await addDoc(collection(db, 'encomiendas'), data);

      return docRef.id;
    } catch (error) {
      console.error('Error creando encomienda:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las encomiendas del usuario actual
   */
  async obtenerEncomiendas(): Promise<Encomienda[]> {
    try {
      const encomiendasRef = collection(db, 'encomiendas');
      const q = query(encomiendasRef);
      const snapshot = await getDocs(q);

      const encomiendas: Encomienda[] = [];
      snapshot.forEach(doc => {
        encomiendas.push({
          id: doc.id,
          ...doc.data()
        } as Encomienda);
      });

      return encomiendas.sort((a, b) => {
        const dateA = new Date(a.fecha_creacion).getTime();
        const dateB = new Date(b.fecha_creacion).getTime();
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error obteniendo encomiendas:', error);
      throw error;
    }
  }

  /**
   * Obtiene las encomiendas de un encomendista específico
   */
  async obtenerEncomiendasPorEncomendista(encomendista_id: string): Promise<Encomienda[]> {
    try {
      const encomiendasRef = collection(db, 'encomiendas');
      const q = query(
        encomiendasRef,
        where('encomendista_id', '==', encomendista_id)
      );
      const snapshot = await getDocs(q);

      const encomiendas: Encomienda[] = [];
      snapshot.forEach(doc => {
        encomiendas.push({
          id: doc.id,
          ...doc.data()
        } as Encomienda);
      });

      return encomiendas;
    } catch (error) {
      console.error('Error obteniendo encomiendas:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de una encomienda
   */
  async actualizarEstadoEncomienda(
    encomienda_id: string,
    estado: 'pendiente' | 'confirmada' | 'entregada' | 'cancelada'
  ): Promise<void> {
    try {
      const docRef = doc(db, 'encomiendas', encomienda_id);
      await updateDoc(docRef, { estado });
    } catch (error) {
      console.error('Error actualizando estado:', error);
      throw error;
    }
  }

  /**
   * Calcula el total de una encomienda según el tipo de precio
   */
  calcularTotal(precio: PrecioEncomienda): number {
    if (precio.tipo === 'por_prenda') {
      return precio.valor * (precio.cantidad_prendas || 0);
    }
    return precio.valor; // Monto fijo
  }
}
