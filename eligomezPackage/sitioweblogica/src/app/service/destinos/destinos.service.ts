import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../environments/firebase.config';

export interface Destino {
  id: string;
  nombre: string;
  costo: number;
  activo: boolean;
}

export interface FranjaEntrega {
  id: string;
  destino_id: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DestinosService {
  private destinos = new BehaviorSubject<Destino[]>([]);
  public destinos$ = this.destinos.asObservable();

  private franjas = new BehaviorSubject<FranjaEntrega[]>([]);
  public franjas$ = this.franjas.asObservable();

  constructor() {
    this.cargarDestinosInterno();
    this.cargarFranjasInterno();
  }

  /**
   * Carga todos los destinos disponibles retornando Observable
   */
  cargarDestinos(): Observable<Destino[]> {
    return this.destinos$;
  }

  /**
   * Carga internamente los destinos desde Firestore
   */
  private async cargarDestinosInterno(): Promise<void> {
    try {
      const destinosRef = collection(db, 'destinos');
      const q = query(destinosRef, where('activo', '==', true));
      const snapshot = await getDocs(q);

      const destinosList: Destino[] = [];
      snapshot.forEach(doc => {
        destinosList.push({
          id: doc.id,
          ...doc.data()
        } as Destino);
      });

      this.destinos.next(destinosList);
    } catch (error) {
      console.error('Error cargando destinos:', error);
    }
  }

  /**
   * Carga todas las franjas disponibles
   */
  cargarFranjas(): Observable<FranjaEntrega[]> {
    return this.franjas$;
  }

  /**
   * Carga internamente las franjas desde Firestore
   */
  private async cargarFranjasInterno(): Promise<void> {
    try {
      const franjasRef = collection(db, 'franjas-entrega');
      const q = query(franjasRef, where('activo', '==', true));
      const snapshot = await getDocs(q);

      const franjasList: FranjaEntrega[] = [];
      snapshot.forEach(doc => {
        franjasList.push({
          id: doc.id,
          ...doc.data()
        } as FranjaEntrega);
      });

      this.franjas.next(franjasList);
    } catch (error) {
      console.error('Error cargando franjas:', error);
    }
  }

  /**
   * Obtiene las franjas filtradas por destino
   */
  obtenerFranjasPorDestino(destino_id: string): Observable<FranjaEntrega[]> {
    return new Observable(observer => {
      const franjasFiltradas = this.franjas.value.filter(f => f.destino_id === destino_id);
      observer.next(franjasFiltradas);
      observer.complete();
    });
  }

  /**
   * Obtiene un destino por ID
   */
  obtenerDestino(destino_id: string): Observable<Destino | undefined> {
    return new Observable(observer => {
      const destino = this.destinos.value.find(d => d.id === destino_id);
      observer.next(destino);
      observer.complete();
    });
  }

  /**
   * Obtiene los días disponibles para un destino
   */
  obtenerDiasDisponibles(destino_id: string): Observable<string[]> {
    return new Observable(observer => {
      const dias = [...new Set(
        this.franjas.value
          .filter(f => f.destino_id === destino_id)
          .map(f => f.dia)
      )];
      observer.next(dias);
      observer.complete();
    });
  }

  /**
   * Crea un nuevo destino
   */
  async crearDestino(nombre: string, costo: number): Promise<string> {
    try {
      const destinosRef = collection(db, 'destinos');
      const docRef = await addDoc(destinosRef, {
        nombre,
        costo,
        activo: true
      });
      
      await this.cargarDestinosInterno();
      return docRef.id;
    } catch (error) {
      console.error('Error creando destino:', error);
      throw error;
    }
  }

  /**
   * Actualiza un destino existente
   */
  async actualizarDestino(destino_id: string, datos: Partial<Destino>): Promise<void> {
    try {
      const docRef = doc(db, 'destinos', destino_id);
      await updateDoc(docRef, datos);
      await this.cargarDestinosInterno();
    } catch (error) {
      console.error('Error actualizando destino:', error);
      throw error;
    }
  }

  /**
   * Crea una nueva franja de entrega
   */
  async crearFranja(
    destino_id: string,
    dia: string,
    hora_inicio: string,
    hora_fin: string
  ): Promise<string> {
    try {
      const franjasRef = collection(db, 'franjas-entrega');
      const docRef = await addDoc(franjasRef, {
        destino_id,
        dia,
        hora_inicio,
        hora_fin,
        activo: true
      });

      await this.cargarFranjasInterno();
      return docRef.id;
    } catch (error) {
      console.error('Error creando franja:', error);
      throw error;
    }
  }

  /**
   * Actualiza una franja existente
   */
  async actualizarFranja(franja_id: string, datos: Partial<FranjaEntrega>): Promise<void> {
    try {
      const docRef = doc(db, 'franjas-entrega', franja_id);
      await updateDoc(docRef, datos);
      await this.cargarFranjasInterno();
    } catch (error) {
      console.error('Error actualizando franja:', error);
      throw error;
    }
  }

  /**
   * Obtiene los destinos únicos
   */
  obtenerDestinosUnicos(): Observable<Destino[]> {
    return this.destinos$;
  }
}
