import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../../environments/firebase.config';

export interface Horario {
  dias: string[]; // Array de días: ["Lunes", "Martes", "Viernes"]
  hora_inicio: string;
  hora_fin: string;
}

export interface DestinoEncomendista {
  nombre: string;
  horarios?: Horario[]; // Nuevo: múltiples horarios
  dia?: string; // Legacy: mantener para compatibilidad
  hora_inicio?: string; // Legacy
  hora_fin?: string; // Legacy
  local?: string | null; // Lugar/dirección donde se recibe (opcional o nulo)
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

@Injectable({
  providedIn: 'root'
})
export class EncomendistasService {
  private encomendistas = new BehaviorSubject<Encomendista[]>([]);
  public encomendistas$ = this.encomendistas.asObservable();

  constructor() {
    this.cargarEncomendistasInterno();
  }

  /**
   * Carga todos los encomendistas activos
   */
  cargarEncomendistas(): Observable<Encomendista[]> {
    return this.encomendistas$;
  }

  /**
   * Carga TODAS las encomendistas incluyendo inactivas (para administración)
   */
  async cargarTodasLasEncomendistas(): Promise<Encomendista[]> {
    try {
      const encomendistasRef = collection(db, 'encomendistas');
      // NO filtrar por activo - obtener todas
      const snapshot = await getDocs(encomendistasRef);

      const encomendistas: Encomendista[] = [];
      snapshot.forEach(doc => {
        encomendistas.push({
          id: doc.id,
          ...doc.data()
        } as Encomendista);
      });

      return encomendistas;
    } catch (error) {
      console.error('Error cargando todas las encomendistas:', error);
      throw error;
    }
  }

  /**
   * Carga encomendistas desde Firestore
   */
  private async cargarEncomendistasInterno(): Promise<void> {
    try {
      const encomendistasRef = collection(db, 'encomendistas');
      const q = query(encomendistasRef, where('activo', '==', true));
      const snapshot = await getDocs(q);

      const encomendistas: Encomendista[] = [];
      snapshot.forEach(doc => {
        encomendistas.push({
          id: doc.id,
          ...doc.data()
        } as Encomendista);
      });

      this.encomendistas.next(encomendistas);
    } catch (error) {
      console.error('Error cargando encomendistas:', error);
    }
  }

  /**
   * Obtiene un encomendista por ID
   */
  obtenerEncomendista(id: string): Observable<Encomendista | undefined> {
    return new Observable(observer => {
      const encomendista = this.encomendistas.value.find(e => e.id === id);
      observer.next(encomendista);
      observer.complete();
    });
  }

  /**
   * Crea un nuevo encomendista
   */
  async crearEncomendista(
    nombre: string,
    destinos: DestinoEncomendista[] | string[],
    telefono?: string,
    local?: string
  ): Promise<string> {
    try {
      const encomendistasRef = collection(db, 'encomendistas');
      
      // Convertir array de strings a DestinoEncomendista si es necesario
      let destinosFormateados: DestinoEncomendista[] = [];
      if (destinos && destinos.length > 0) {
        destinosFormateados = destinos.map(d => {
          if (typeof d === 'string') {
            return { nombre: d };
          }
          return d as DestinoEncomendista;
        });
      }
      
      const data: any = {
        nombre,
        destinos: destinosFormateados,
        activo: true,
        fecha_creacion: new Date().toISOString()
      };
      
      // Solo agregar campos opcionales si tienen valor
      if (telefono && telefono !== 'undefined') data.telefono = telefono;
      if (local && local !== 'undefined') data.local = local;
      
      const docRef = await addDoc(encomendistasRef, data);

      await this.cargarEncomendistasInterno();
      return docRef.id;
    } catch (error) {
      console.error('Error creando encomendista:', error);
      throw error;
    }
  }

  /**
   * Actualiza un encomendista
   */
  async actualizarEncomendista(encomendista: Encomendista): Promise<void> {
    try {
      const docRef = doc(db, 'encomendistas', encomendista.id);
      const { id, ...datos } = encomendista;
      
      // Convertir undefined a null para Firebase
      const datosLimpios = Object.entries(datos).reduce((acc: any, [key, value]) => {
        if (value === undefined) {
          acc[key] = null;
        } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Para objetos anidados, también limpiar sus valores
          acc[key] = Object.entries(value).reduce((subAcc: any, [subKey, subValue]) => {
            subAcc[subKey] = subValue === undefined ? null : subValue;
            return subAcc;
          }, {});
        } else if (Array.isArray(value)) {
          // Para arrays (como destinos con horarios), limpiar valores en cada elemento
          acc[key] = value.map((item: any) => {
            if (typeof item === 'object' && item !== null) {
              return Object.entries(item).reduce((subAcc: any, [subKey, subValue]) => {
                subAcc[subKey] = subValue === undefined ? null : subValue;
                return subAcc;
              }, {});
            }
            return item;
          });
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});
      
      await updateDoc(docRef, datosLimpios);
      await this.cargarEncomendistasInterno();
    } catch (error) {
      console.error('Error actualizando encomendista:', error);
      throw error;
    }
  }

  /**
   * Elimina un encomendista (lo marca como inactivo)
   */
  async eliminarEncomendista(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'encomendistas', id);
      // Usar deleteDoc para eliminar permanentemente, no solo inactivar
      await deleteDoc(docRef);
      await this.cargarEncomendistasInterno();
    } catch (error) {
      console.error('Error eliminando encomendista:', error);
      throw error;
    }
  }

  /**
   * Obtiene los destinos de un encomendista
   */
  obtenerDestinosEncomendista(encomendista_id: string): Observable<DestinoEncomendista[]> {
    return new Observable(observer => {
      const encomendista = this.encomendistas.value.find(e => e.id === encomendista_id);
      observer.next(encomendista?.destinos || []);
      observer.complete();
    });
  }

  /**
   * Obtiene los horarios de un destino específico del encomendista
   */
  obtenerHorarioDestino(
    encomendista_id: string,
    nombreDestino: string
  ): Observable<DestinoEncomendista | undefined> {
    return new Observable(observer => {
      const encomendista = this.encomendistas.value.find(e => e.id === encomendista_id);
      const destino = encomendista?.destinos.find(d => d.nombre === nombreDestino);
      observer.next(destino);
      observer.complete();
    });
  }

  /**
   * Agrega un destino a un encomendista
   */
  async agregarDestinoEncomendista(
    encomendista_id: string,
    destino: DestinoEncomendista
  ): Promise<void> {
    try {
      const encomendista = this.encomendistas.value.find(e => e.id === encomendista_id);
      if (!encomendista) throw new Error('Encomendista no encontrado');

      // Limpiar valores undefined en el destino
      const destinoLimpio = Object.entries(destino).reduce((acc: any, [key, value]) => {
        if (value === undefined) {
          acc[key] = null;
        } else if (Array.isArray(value)) {
          // Limpiar horarios si existen
          acc[key] = value.map((item: any) => {
            if (typeof item === 'object' && item !== null) {
              return Object.entries(item).reduce((subAcc: any, [subKey, subValue]) => {
                subAcc[subKey] = subValue === undefined ? null : subValue;
                return subAcc;
              }, {});
            }
            return item;
          });
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});

      const destinos = [...encomendista.destinos, destinoLimpio];
      const docRef = doc(db, 'encomendistas', encomendista_id);
      await updateDoc(docRef, { destinos });

      await this.cargarEncomendistasInterno();
    } catch (error) {
      console.error('Error agregando destino:', error);
      throw error;
    }
  }
}
