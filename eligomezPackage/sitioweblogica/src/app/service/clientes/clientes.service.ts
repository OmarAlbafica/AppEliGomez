import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db, auth } from '../../environments/firebase.config';

export interface Cliente {
  id: string;
  usuario_id: string;
  nombre: string;
  telefono: string;
  direccion?: string;
  activo: boolean;
  fecha_creacion: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ClientesService {
  private clientes = new BehaviorSubject<Cliente[]>([]);
  public clientes$ = this.clientes.asObservable();

  constructor() {
    this.cargarClientesInterno();
  }

  /**
   * Carga todos los clientes del usuario actual
   */
  cargarClientes(): Observable<Cliente[]> {
    // Si no hay clientes cargados, intenta cargar del servidor
    if (this.clientes.value.length === 0) {
      this.cargarClientesInterno();
    }
    return this.clientes$;
  }

  /**
   * Recarga forzadamente los clientes desde Firestore
   * Intenta hasta que el usuario esté autenticado
   */
  async recargarClientes(): Promise<void> {
    let intentos = 0;
    const maxIntentos = 10;
    
    while (intentos < maxIntentos && !auth.currentUser?.uid) {
      console.log(`Esperando autenticación (clientes)... intento ${intentos + 1}/${maxIntentos}`);
      await new Promise(resolve => setTimeout(resolve, 500)); // Espera 500ms
      intentos++;
    }
    
    if (!auth.currentUser?.uid) {
      console.warn('No se pudo autenticar clientes después de varios intentos');
      return;
    }
    
    await this.cargarClientesInterno();
  }

  /**
   * Carga clientes desde Firestore (interno)
   */
  private async cargarClientesInterno() {
    try {
      const clientesRef = collection(db, 'clientes');
      const q = query(clientesRef);
      const snapshot = await getDocs(q);

      const clientes: Cliente[] = [];
      snapshot.forEach(doc => {
        try {
          const data = doc.data();
          clientes.push({
            id: doc.id,
            usuario_id: data['usuario_id'],
            nombre: data['nombre'],
            telefono: data['telefono'],
            direccion: data['direccion'] || undefined,
            activo: data['activo'] ?? true,
            fecha_creacion: data['fecha_creacion'] ? new Date(data['fecha_creacion']) : new Date()
          } as Cliente);
        } catch (e) {
          console.error('Error procesando cliente:', doc.id, e);
        }
      });

      console.log(`Clientes cargados: ${clientes.length}`, clientes);
      this.clientes.next(clientes.sort((a, b) => b.fecha_creacion.getTime() - a.fecha_creacion.getTime()));
    } catch (error) {
      console.error('Error cargando clientes:', error);
    }
  }

  /**
   * Crea un nuevo cliente
   */
  async crearCliente(nombre: string, telefono?: string, direccion?: string): Promise<string> {
    try {
      const usuario_id = auth.currentUser?.uid;
      if (!usuario_id) throw new Error('Usuario no autenticado');

      const data: any = {
        usuario_id,
        nombre: (nombre || '').trim(),
        activo: true,
        fecha_creacion: new Date().toISOString()
      };

      // Solo agregar campos si tienen valor y no son undefined
      if (telefono && telefono !== 'undefined') {
        data.telefono = telefono.trim();
      }
      if (direccion && direccion !== 'undefined') {
        data.direccion = direccion.trim();
      } else {
        data.direccion = null;
      }

      const docRef = await addDoc(collection(db, 'clientes'), data);

      await this.cargarClientesInterno();
      return docRef.id;
    } catch (error) {
      console.error('Error creando cliente:', error);
      throw error;
    }
  }

  /**
   * Busca clientes por nombre
   */
  buscarClientesPorNombre(nombre: string): Observable<Cliente[]> {
    return new Observable(observer => {
      const clientes = this.clientes.value.filter(c =>
        c.nombre.toLowerCase().includes(nombre.toLowerCase())
      );
      observer.next(clientes);
      observer.complete();
    });
  }

  /**
   * Obtiene un cliente por ID
   */
  obtenerClienteporId(id: string): Observable<Cliente | undefined> {
    return new Observable(observer => {
      const cliente = this.clientes.value.find(c => c.id === id);
      observer.next(cliente);
      observer.complete();
    });
  }

  /**
   * Actualiza un cliente
   */
  async actualizarCliente(cliente: Cliente): Promise<void> {
    try {
      const docRef = doc(db, 'clientes', cliente.id);
      const { id, usuario_id, fecha_creacion, ...datos } = cliente;

      // Convertir undefined a null para Firebase
      const datosLimpios = Object.entries(datos).reduce((acc: any, [key, value]) => {
        acc[key] = value === undefined ? null : value;
        return acc;
      }, {});

      await updateDoc(docRef, datosLimpios);
      await this.cargarClientesInterno();
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      throw error;
    }
  }

  /**
   * Elimina un cliente por ID
   */
  async eliminarCliente(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'clientes', id);
      await deleteDoc(docRef);
      await this.cargarClientesInterno();
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      throw error;
    }
  }

  /**
   * Obtiene los clientes actuales en memoria (sin esperar carga)
   */
  obtenerClientesActuales(): Cliente[] {
    return this.clientes.value;
  }
}
