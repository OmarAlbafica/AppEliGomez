import { Injectable } from '@angular/core';
import { collection, addDoc, deleteDoc, doc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../environments/firebase.config';

export interface FavoritoPedido {
  id?: string;
  usuario_id: string;
  cliente_id: string;
  cliente_nombre: string;
  encomendista_id: string;
  encomendista_nombre: string;
  modo: 'normal' | 'personalizado';
  destino_id?: string;
  destino_nombre?: string;
  direccion_personalizada?: string;
  descripcion?: string;
  dia_maximo?: string;
  fecha_creacion?: Date;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FavoritosPedidosService {
  constructor() {
    console.log('✅ FavoritosPedidosService inicializado - Usando Firebase Firestore');
  }

  /**
   * Crear un nuevo favorito de pedido - SOLO FIREBASE
   */
  async crearFavorito(favorito: FavoritoPedido): Promise<string> {
    try {
      // Limpiar campos undefined para que Firebase no los rechace
      const favoritoLimpio: any = {};
      Object.keys(favorito).forEach(key => {
        const value = (favorito as any)[key];
        if (value !== undefined && value !== null) {
          favoritoLimpio[key] = value;
        }
      });

      const favoritosRef = collection(db, 'favoritos_pedidos');
      const docRef = await addDoc(favoritosRef, {
        ...favoritoLimpio,
        fecha_creacion: new Date(),
        activo: true
      });
      console.log('%c✅ FAVORITO GUARDADO EN FIREBASE', 'color: green; font-weight: bold', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creando favorito:', error);
      throw error;
    }
  }

  /**
   * Obtener favoritos por cliente - SIN FILTRO DE USUARIO (muestra favoritos de todos) - SOLO FIREBASE
   */
  async obtenerFavoritosPorCliente(clienteId: string): Promise<FavoritoPedido[]> {
    try {
      const favoritosRef = collection(db, 'favoritos_pedidos');
      const q = query(
        favoritosRef,
        where('cliente_id', '==', clienteId),
        where('activo', '==', true)
      );
      const snapshot = await getDocs(q);
      console.log(`%c🎯 Favoritos para cliente ${clienteId}: ${snapshot.docs.length}`, 'color: blue; font-weight: bold');
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FavoritoPedido));
    } catch (error) {
      console.error('Error obteniendo favoritos:', error);
      return [];
    }
  }

  /**
   * Obtener todos los favoritos - SOLO FIREBASE
   */
  async obtenerTodosFavoritos(): Promise<FavoritoPedido[]> {
    try {
      const favoritosRef = collection(db, 'favoritos_pedidos');
      const q = query(favoritosRef, where('activo', '==', true));
      const snapshot = await getDocs(q);
      console.log(`%c📊 TOTAL FAVORITOS EN FIREBASE: ${snapshot.docs.length}`, 'color: green; font-size: 14px; font-weight: bold');
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FavoritoPedido));
    } catch (error) {
      console.error('Error obteniendo favoritos:', error);
      return [];
    }
  }

  /**
   * Actualizar un favorito
   */
  async actualizarFavorito(favoritoId: string, data: Partial<FavoritoPedido>): Promise<void> {
    try {
      const favoritoRef = doc(db, 'favoritos_pedidos', favoritoId);
      await updateDoc(favoritoRef, data);
      console.log('✅ Favorito actualizado:', favoritoId);
    } catch (error) {
      console.error('Error actualizando favorito:', error);
      throw error;
    }
  }

  /**
   * Eliminar un favorito (soft delete - marca como inactivo)
   */
  async eliminarFavorito(favoritoId: string): Promise<void> {
    try {
      const favoritoRef = doc(db, 'favoritos_pedidos', favoritoId);
      await updateDoc(favoritoRef, { activo: false });
      console.log('✅ Favorito eliminado (marcado como inactivo):', favoritoId);
    } catch (error) {
      console.error('Error eliminando favorito:', error);
      throw error;
    }
  }

  /**
   * Eliminar permanentemente un favorito
   */
  async eliminarFavoritoPermanente(favoritoId: string): Promise<void> {
    try {
      const favoritoRef = doc(db, 'favoritos_pedidos', favoritoId);
      await deleteDoc(favoritoRef);
      console.log('✅ Favorito eliminado permanentemente:', favoritoId);
    } catch (error) {
      console.error('Error eliminando favorito permanentemente:', error);
      throw error;
    }
  }

  /**
   * Migra favoritos de localStorage a Firebase si no existen
   * Valida que no duplique favoritos existentes en Firebase
   */
  async migrarFavoritosLocalStorageAFirebase(): Promise<{ migrados: number; duplicados: number }> {
    try {
      const favoritosLS = JSON.parse(localStorage.getItem('favoritos_pedidos') || '[]') as FavoritoPedido[];
      
      if (favoritosLS.length === 0) {
        console.log('✅ No hay favoritos en localStorage para migrar');
        return { migrados: 0, duplicados: 0 };
      }

      console.log(`🔄 Iniciando migración de ${favoritosLS.length} favoritos de localStorage a Firebase...`);

      let migrados = 0;
      let duplicados = 0;

      // Para cada favorito de localStorage
      for (const favLS of favoritosLS) {
        try {
          // Verificar si ya existe en Firebase basado en cliente + encomendista + (destino o dirección)
          const favoritosRef = collection(db, 'favoritos_pedidos');
          let queryConstraints: any[] = [
            where('cliente_id', '==', favLS.cliente_id),
            where('encomendista_id', '==', favLS.encomendista_id),
            where('activo', '==', true)
          ];

          // Agregar filtro adicional por destino o dirección personalizada
          if (favLS.modo === 'normal' && favLS.destino_id) {
            queryConstraints.push(where('destino_id', '==', favLS.destino_id));
          } else if (favLS.modo === 'personalizado' && favLS.direccion_personalizada) {
            queryConstraints.push(where('direccion_personalizada', '==', favLS.direccion_personalizada));
          }

          const q = query(favoritosRef, ...queryConstraints);
          const snapshot = await getDocs(q);

          if (snapshot.empty) {
            // No existe en Firebase, agregarlo
            const favoritoParaGuardar: FavoritoPedido = {
              ...favLS,
              fecha_creacion: favLS.fecha_creacion || new Date()
            };

            const docRef = await addDoc(favoritosRef, favoritoParaGuardar);
            migrados++;
            console.log(`✅ Favorito migrado: ${favLS.cliente_nombre} → ${favLS.encomendista_nombre}`);
          } else {
            // Ya existe en Firebase
            duplicados++;
            console.log(`⏭️ Favorito duplicado, omitido: ${favLS.cliente_nombre} → ${favLS.encomendista_nombre}`);
          }
        } catch (error) {
          console.error(`❌ Error migrando favorito:`, favLS, error);
        }
      }

      // Limpiar localStorage después de migrar exitosamente
      if (migrados > 0) {
        localStorage.removeItem('favoritos_pedidos');
        console.log(`🎉 Migración completada: ${migrados} favoritos migrados, ${duplicados} duplicados omitidos`);
      }

      return { migrados, duplicados };
    } catch (error) {
      console.error('Error en migración de favoritos:', error);
      return { migrados: 0, duplicados: 0 };
    }
  }
}

