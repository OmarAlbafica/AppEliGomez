import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export interface Pedido {
  id?: string;
  codigo_pedido: string; // "PED-20250124-ABC123"
  cliente_id: string;
  cliente_nombre?: string;
  encomendista_nombre?: string;
  telefono_cliente?: string;
  tienda_id: string;
  nombre_tienda?: string;
  nombre_perfil?: string;
  cantidad_prendas: number;
  costo_prendas: number;
  monto_envio: number;
  total: number;
  dia_entrega: string; // Nombre del día: "Lunes", "Martes", etc.
  fecha_entrega_programada?: Date;
  hora_inicio?: string; // "09:00"
  hora_fin?: string; // "17:00"
  notas?: string;
  modo: 'normal' | 'personalizado';
  // Modo normal
  encomendista_id?: string;
  destino_id?: string;
  destino_nombre?: string;
  // Modo personalizado
  direccion_personalizada?: string;
  // Productos
  productos_id?: string[];
  productos_codigos?: string[]; // Códigos de los productos para referencia rápida
  // Imágenes
  foto_paquete?: string; // URL de la foto del paquete empacado
  // Estado
  estado: 'pendiente' | 'procesando' | 'entregado' | 'cancelado' | 'enviado' | 'retirado' | 'no-retirado' | 'remunero' | 'empacada';
  // Auditoría
  fecha_creacion?: Date;
  created_on?: 'APP' | 'WEB'; // Indica si fue creado desde la app móvil o desde el web
  activo: boolean;
}

class PedidosService {
  /**
   * Helper privado: Enriquece destino_nombre desde los destinos del encomendista
   * Si destino_nombre está vacío, busca en los destinos del encomendista
   */
  private async enriquecerDestino(
    pedido: any,
    encomendista_id?: string
  ): Promise<string | undefined> {
    try {
      // Si ya tiene destino_nombre y no está vacío, retornar como está
      if (pedido.destino_nombre && pedido.destino_nombre.trim()) {
        return pedido.destino_nombre;
      }

      // Si no hay encomendista_id, no hay forma de buscar destino
      if (!encomendista_id) {
        return undefined;
      }

      // Buscar en los destinos del encomendista
      const encomendstaDocRef = doc(db, 'encomendistas', encomendista_id);
      const encomendstaDoc = await getDoc(encomendstaDocRef);

      if (encomendstaDoc.exists()) {
        const destinos = encomendstaDoc.data()['destinos'] || [];
        // Si existe destino_id, buscar por nombre dentro del array
        if (pedido.destino_id && destinos.length > 0) {
          const destinoEncontrado = destinos.find(
            (d: any) => d.nombre === pedido.destino_id
          );
          if (destinoEncontrado) {
            return destinoEncontrado.nombre;
          }
        }
        // Si no encontró por ID pero hay destinos, retornar el primero como fallback
        if (destinos.length > 0) {
          return destinos[0].nombre;
        }
      }

      return undefined;
    } catch (error) {
      console.warn(`⚠️ Error enriqueciendo destino para encomendista ${encomendista_id}:`, error);
      return pedido.destino_nombre || undefined;
    }
  }

  /**
   * Obtiene pedidos para remunerar según fechas
   */
  async obtenerPedidosPorRemunerar(): Promise<Pedido[]> {
    try {
      const hoy = new Date();
      const diaActual = hoy.getDay(); // 0=Domingo, 1=Lunes... 3=Miércoles, 6=Sábado

      let fechaInicio = new Date(hoy);
      fechaInicio.setHours(0, 0, 0, 0);

      // Calcular fecha de inicio según el día actual
      if (diaActual === 6) {
        // HOY es SÁBADO: mostrar desde MIÉRCOLES anterior (3 días atrás)
        fechaInicio.setDate(hoy.getDate() - 3);
      } else if (diaActual === 3) {
        // HOY es MIÉRCOLES: mostrar desde SÁBADO anterior (4 días atrás)
        fechaInicio.setDate(hoy.getDate() - 4);
      } else if (diaActual > 3 && diaActual < 6) {
        // Jueves (4), Viernes (5): mostrar desde MIÉRCOLES anterior
        fechaInicio.setDate(hoy.getDate() - (diaActual - 3));
      } else {
        // Domingo (0), Lunes (1), Martes (2): mostrar desde SÁBADO anterior
        const diasAtras = diaActual === 0 ? 1 : diaActual + 1;
        fechaInicio.setDate(hoy.getDate() - diasAtras);
      }

      const fechaFin = new Date(hoy);
      fechaFin.setHours(23, 59, 59, 999);

      // Estados que QUEREMOS mostrar
      const estadosPermitidos = ['enviado', 'retirado', 'no-retirado'];

      // Obtener todos los pedidos activos
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('activo', '==', true));
      const snapshot = await getDocs(q);

      const pedidosFiltrados: Pedido[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const fechaCreacion = data['fecha_creacion']
          ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
          : new Date();

        const estado = data['estado']?.toLowerCase() || '';
        const estaEnRango = fechaCreacion >= fechaInicio && fechaCreacion <= fechaFin;
        const estadoValido = estadosPermitidos.includes(estado);

        if (estaEnRango && estadoValido) {
          let clienteNombre = data['cliente_nombre'] || undefined;
          let encomendistaNombre = data['encomendista_nombre'] || undefined;
          let destinoNombre = data['destino_nombre'] || undefined;

          // JOIN: Si falta cliente_nombre
          if (!clienteNombre && data['cliente_id']) {
            try {
              const clienteDocRef = doc(db, 'clientes', data['cliente_id']);
              const clienteDoc = await getDoc(clienteDocRef);
              if (clienteDoc.exists()) {
                clienteNombre = clienteDoc.data()['nombre'] || undefined;
              }
            } catch (error) {
              console.warn(`⚠️ Error buscando cliente ${data['cliente_id']}:`, error);
            }
          }

          // JOIN: Si falta encomendista_nombre
          if (!encomendistaNombre && data['encomendista_id']) {
            try {
              const encomendstaDocRef = doc(db, 'encomendistas', data['encomendista_id']);
              const encomendstaDoc = await getDoc(encomendstaDocRef);
              if (encomendstaDoc.exists()) {
                encomendistaNombre = encomendstaDoc.data()['nombre'] || undefined;
              }
            } catch (error) {
              console.warn(`⚠️ Error buscando encomendista ${data['encomendista_id']}:`, error);
            }
          }

          // JOIN: Si falta destino_nombre, buscar en encomendista
          if (!destinoNombre && data['encomendista_id']) {
            destinoNombre = await this.enriquecerDestino(data, data['encomendista_id']);
          }

          pedidosFiltrados.push({
            id: docSnapshot.id,
            codigo_pedido: data['codigo_pedido'] || '',
            cliente_id: data['cliente_id'] || '',
            cliente_nombre: clienteNombre,
            encomendista_nombre: encomendistaNombre,
            telefono_cliente: data['telefono_cliente'],
            tienda_id: data['tienda_id'] || '',
            nombre_tienda: data['nombre_tienda'],
            nombre_perfil: data['nombre_perfil'],
            cantidad_prendas: data['cantidad_prendas'] || 0,
            costo_prendas: data['costo_prendas'] || 0,
            monto_envio: data['monto_envio'] || 0,
            total: data['total'] || 0,
            dia_entrega: data['dia_entrega'] || '',
            fecha_entrega_programada: data['fecha_entrega_programada']
              ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
              : undefined,
            hora_inicio: data['hora_inicio'],
            hora_fin: data['hora_fin'],
            notas: data['notas'],
            modo: data['modo'] || 'normal',
            encomendista_id: data['encomendista_id'],
            destino_id: data['destino_id'],
            destino_nombre: destinoNombre,
            direccion_personalizada: data['direccion_personalizada'],
            productos_id: data['productos_id'] || [],
            productos_codigos: data['productos_codigos'] || [],
            estado: estado as any,
            fecha_creacion: fechaCreacion,
            created_on: data['created_on'],
            activo: data['activo'] ?? true,
          });
        }
      }

      console.log(`✅ ${pedidosFiltrados.length} pedidos para remunerar encontrados`);
      return pedidosFiltrados;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos por remunerar:', error);
      return [];
    }
  }

  /**
   * Obtiene todos los pedidos (historial completo)
   * Con filtro de estado 'pendiente' y lazy loading de 100
   */
  async obtenerHistorialPedidos(pageNumber: number = 0): Promise<Pedido[]> {
    try {
      const pedidosRef = collection(db, 'pedidos');
      // Filtrar solo pedidos con estado 'pendiente', sin límite en la query para mantener compatibilidad
      // pero se pagina en memoria
      const q = query(pedidosRef, where('estado', '==', 'pendiente'));
      const snapshot = await getDocs(q);

      const pedidos: Pedido[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let clienteNombre = data['cliente_nombre'] || undefined;
        let encomendistaNombre = data['encomendista_nombre'] || undefined;
        let destinoNombre = data['destino_nombre'] || undefined;

        // JOIN: Si falta cliente_nombre, buscar en la colección de clientes
        if (!clienteNombre && data['cliente_id']) {
          try {
            const clienteDocRef = doc(db, 'clientes', data['cliente_id']);
            const clienteDoc = await getDoc(clienteDocRef);
            if (clienteDoc.exists()) {
              clienteNombre = clienteDoc.data()['nombre'] || undefined;
            }
          } catch (error) {
            console.warn(`⚠️ Error buscando cliente ${data['cliente_id']}:`, error);
          }
        }

        // JOIN: Si falta encomendista_nombre, buscar en la colección de encomendistas
        if (!encomendistaNombre && data['encomendista_id']) {
          try {
            const encomendstaDocRef = doc(db, 'encomendistas', data['encomendista_id']);
            const encomendstaDoc = await getDoc(encomendstaDocRef);
            if (encomendstaDoc.exists()) {
              encomendistaNombre = encomendstaDoc.data()['nombre'] || undefined;
            }
          } catch (error) {
            console.warn(`⚠️ Error buscando encomendista ${data['encomendista_id']}:`, error);
          }
        }

        // JOIN: Si falta destino_nombre, buscar en encomendista
        if (!destinoNombre && data['encomendista_id']) {
          destinoNombre = await this.enriquecerDestino(data, data['encomendista_id']);
        }

        pedidos.push({
          id: docSnapshot.id,
          codigo_pedido: data['codigo_pedido'] || '',
          cliente_id: data['cliente_id'] || '',
          cliente_nombre: clienteNombre,
          encomendista_nombre: encomendistaNombre,
          telefono_cliente: data['telefono_cliente'] || undefined,
          tienda_id: data['tienda_id'] || '',
          nombre_tienda: data['nombre_tienda'] || undefined,
          nombre_perfil: data['nombre_perfil'] || undefined,
          cantidad_prendas: data['cantidad_prendas'] || 0,
          costo_prendas: data['costo_prendas'] || 0,
          monto_envio: data['monto_envio'] || 0,
          total: data['total'] || 0,
          dia_entrega: data['dia_entrega'] || '',
          fecha_entrega_programada: data['fecha_entrega_programada']
            ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
            : undefined,
          hora_inicio: data['hora_inicio'] || undefined,
          hora_fin: data['hora_fin'] || undefined,
          notas: data['notas'] || undefined,
          modo: data['modo'] || 'normal',
          encomendista_id: data['encomendista_id'] || undefined,
          destino_id: data['destino_id'] || undefined,
          destino_nombre: destinoNombre,
          direccion_personalizada: data['direccion_personalizada'] || undefined,
          productos_id: data['productos_id'] || [],
          productos_codigos: data['productos_codigos'] || [],
          estado: data['estado'] || 'pendiente',
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
          created_on: data['created_on'] || undefined,
          activo: data['activo'] ?? true,
        });
      }

      // Ordenar por fecha descendente (más recientes primero)
      const pedidosOrdenados = pedidos.sort((a, b) => {
        const fechaB = b.fecha_creacion?.getTime() || 0;
        const fechaA = a.fecha_creacion?.getTime() || 0;
        return fechaB - fechaA;
      });

      // Lazy loading: retornar solo 100 pedidos por página
      const pageSize = 100;
      const startIndex = pageNumber * pageSize;
      const endIndex = startIndex + pageSize;

      console.log(`✅ ${pedidosOrdenados.length} pedidos pendientes encontrados (página ${pageNumber}, mostrando ${Math.min(pageSize, pedidosOrdenados.length - startIndex)})`);
      return pedidosOrdenados.slice(startIndex, endIndex);
    } catch (error) {
      console.error('❌ Error obteniendo historial de pedidos:', error);
      return [];
    }
  }

  /**
   * Obtiene el total de pedidos pendientes (para paginación)
   */
  async obtenerTotalPedidosPendientes(): Promise<number> {
    try {
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('estado', '==', 'pendiente'));
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('❌ Error obteniendo total de pedidos:', error);
      return 0;
    }
  }

  /**
   * Carga todos los pedidos del usuario actual
   */
  async cargarPedidos(): Promise<Pedido[]> {
    try {
      const usuarioId = auth.currentUser?.uid;
      if (!usuarioId) {
        console.warn('⚠️ No hay usuario autenticado para cargar pedidos');
        return [];
      }

      const pedidosRef = collection(db, 'pedidos');
      // Ajustar query según estructura de datos
      // Por ahora asumimos que hay un campo usuario_id o se filtra por tienda
      const q = query(pedidosRef);

      const snapshot = await getDocs(q);
      const pedidos: Pedido[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        let clienteNombre = data['cliente_nombre'] || undefined;
        let encomendistaNombre = data['encomendista_nombre'] || undefined;
        let destinoNombre = data['destino_nombre'] || undefined;

        // JOIN: Si falta cliente_nombre
        if (!clienteNombre && data['cliente_id']) {
          try {
            const clienteDocRef = doc(db, 'clientes', data['cliente_id']);
            const clienteDoc = await getDoc(clienteDocRef);
            if (clienteDoc.exists()) {
              clienteNombre = clienteDoc.data()['nombre'] || undefined;
            }
          } catch (error) {
            console.warn(`⚠️ Error buscando cliente ${data['cliente_id']}:`, error);
          }
        }

        // JOIN: Si falta encomendista_nombre
        if (!encomendistaNombre && data['encomendista_id']) {
          try {
            const encomendstaDocRef = doc(db, 'encomendistas', data['encomendista_id']);
            const encomendstaDoc = await getDoc(encomendstaDocRef);
            if (encomendstaDoc.exists()) {
              encomendistaNombre = encomendstaDoc.data()['nombre'] || undefined;
            }
          } catch (error) {
            console.warn(`⚠️ Error buscando encomendista ${data['encomendista_id']}:`, error);
          }
        }

        // JOIN: Si falta destino_nombre, buscar en encomendista
        if (!destinoNombre && data['encomendista_id']) {
          destinoNombre = await this.enriquecerDestino(data, data['encomendista_id']);
        }

        pedidos.push({
          id: docSnapshot.id,
          codigo_pedido: data['codigo_pedido'] || '',
          cliente_id: data['cliente_id'] || '',
          cliente_nombre: clienteNombre,
          encomendista_nombre: encomendistaNombre,
          telefono_cliente: data['telefono_cliente'] || undefined,
          tienda_id: data['tienda_id'] || '',
          nombre_tienda: data['nombre_tienda'] || undefined,
          nombre_perfil: data['nombre_perfil'] || undefined,
          cantidad_prendas: data['cantidad_prendas'] || 0,
          costo_prendas: data['costo_prendas'] || 0,
          monto_envio: data['monto_envio'] || 0,
          total: data['total'] || 0,
          dia_entrega: data['dia_entrega'] || '',
          fecha_entrega_programada: data['fecha_entrega_programada']
            ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
            : undefined,
          hora_inicio: data['hora_inicio'] || undefined,
          hora_fin: data['hora_fin'] || undefined,
          notas: data['notas'] || undefined,
          modo: data['modo'] || 'normal',
          encomendista_id: data['encomendista_id'] || undefined,
          destino_id: data['destino_id'] || undefined,
          destino_nombre: destinoNombre,
          direccion_personalizada: data['direccion_personalizada'] || undefined,
          productos_id: data['productos_id'] || [],
          productos_codigos: data['productos_codigos'] || [],
          estado: data['estado'] || 'pendiente',
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
          created_on: data['created_on'] || undefined,
          activo: data['activo'] ?? true,
        });
      }

      console.log(`✅ ${pedidos.length} pedidos cargados`);
      return pedidos;
    } catch (error) {
      console.error('❌ Error cargando pedidos:', error);
      throw error;
    }
  }

  /**
   * Obtiene un pedido por ID
   */
  async obtenerPedido(id: string): Promise<Pedido | null> {
    try {
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('id', '==', id));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const docSnapshot = snapshot.docs[0];
      const data = docSnapshot.data();

      let clienteNombre = data['cliente_nombre'] || undefined;
      let encomendistaNombre = data['encomendista_nombre'] || undefined;
      let destinoNombre = data['destino_nombre'] || undefined;

      // JOIN: Si falta cliente_nombre
      if (!clienteNombre && data['cliente_id']) {
        try {
          const clienteDocRef = doc(db, 'clientes', data['cliente_id']);
          const clienteDoc = await getDoc(clienteDocRef);
          if (clienteDoc.exists()) {
            clienteNombre = clienteDoc.data()['nombre'] || undefined;
          }
        } catch (error) {
          console.warn(`⚠️ Error buscando cliente ${data['cliente_id']}:`, error);
        }
      }

      // JOIN: Si falta encomendista_nombre
      if (!encomendistaNombre && data['encomendista_id']) {
        try {
          const encomendstaDocRef = doc(db, 'encomendistas', data['encomendista_id']);
          const encomendstaDoc = await getDoc(encomendstaDocRef);
          if (encomendstaDoc.exists()) {
            encomendistaNombre = encomendstaDoc.data()['nombre'] || undefined;
          }
        } catch (error) {
          console.warn(`⚠️ Error buscando encomendista ${data['encomendista_id']}:`, error);
        }
      }

      // JOIN: Si falta destino_nombre, buscar en encomendista
      if (!destinoNombre && data['encomendista_id']) {
        destinoNombre = await this.enriquecerDestino(data, data['encomendista_id']);
      }

      return {
        id: docSnapshot.id,
        codigo_pedido: data['codigo_pedido'] || '',
        cliente_id: data['cliente_id'] || '',
        cliente_nombre: clienteNombre,
        encomendista_nombre: encomendistaNombre,
        telefono_cliente: data['telefono_cliente'] || undefined,
        tienda_id: data['tienda_id'] || '',
        nombre_tienda: data['nombre_tienda'] || undefined,
        nombre_perfil: data['nombre_perfil'] || undefined,
        cantidad_prendas: data['cantidad_prendas'] || 0,
        costo_prendas: data['costo_prendas'] || 0,
        monto_envio: data['monto_envio'] || 0,
        total: data['total'] || 0,
        dia_entrega: data['dia_entrega'] || '',
        fecha_entrega_programada: data['fecha_entrega_programada']
          ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
          : undefined,
        hora_inicio: data['hora_inicio'] || undefined,
        hora_fin: data['hora_fin'] || undefined,
        notas: data['notas'] || undefined,
        modo: data['modo'] || 'normal',
        encomendista_id: data['encomendista_id'] || undefined,
        destino_id: data['destino_id'] || undefined,
        destino_nombre: destinoNombre,
        direccion_personalizada: data['direccion_personalizada'] || undefined,
        productos_id: data['productos_id'] || [],
        productos_codigos: data['productos_codigos'] || [],
        estado: data['estado'] || 'pendiente',
        fecha_creacion: data['fecha_creacion']
          ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
          : new Date(),
        created_on: data['created_on'] || undefined,
        activo: data['activo'] ?? true,
      };
    } catch (error) {
      console.error('❌ Error obteniendo pedido:', error);
      return null;
    }
  }

  /**
   * Crea un nuevo pedido con la estructura completa
   */
  async crearPedido(pedido: Omit<Pedido, 'id' | 'fecha_creacion' | 'activo'>): Promise<string> {
    try {
      // Validaciones básicas
      if (!pedido.cliente_id) throw new Error('cliente_id es requerido');
      if (!pedido.tienda_id) throw new Error('tienda_id es requerido');
      if (!pedido.codigo_pedido) throw new Error('codigo_pedido es requerido');

      const pedidosRef = collection(db, 'pedidos');

      // fecha_entrega_programada ya viene como STRING en formato YYYY-MM-DD
      // No se requiere conversión
      const datosGuardar: any = { ...pedido };

      const docRef = await addDoc(pedidosRef, {
        ...datosGuardar,
        estado: pedido.estado || 'pendiente',
        activo: true,
        fecha_creacion: Timestamp.now(),
      });

      console.log(`💾 Pedido creado: ${docRef.id}`);

      // Marcar productos como reservados
      const productosArray = (pedido as any).productos || (pedido as any).productos_id;
      if (productosArray && productosArray.length > 0) {
        console.log('🟠 Intentando marcar productos como reservados...');
        try {
          const { default: productosService } = await import('./productosService');
          await productosService.marcarComoReservados(productosArray, docRef.id);
          console.log('✅ Productos marcados como reservados');
        } catch (error) {
          console.error('❌ Error marcando productos como reservados:', error);
          // No lanzar error, el pedido ya está creado
        }
      } else {
        console.warn('⚠️ No hay productos para marcar como reservados');
      }

      return docRef.id;
    } catch (error) {
      console.error('❌ Error creando pedido:', error);
      throw error;
    }
  }

  /**
   * Actualiza un pedido
   */
  async actualizarPedido(id: string, datos: Partial<Pedido>): Promise<void> {
    try {
      const pedidoRef = doc(db, 'pedidos', id);
      const actualizacion: any = { ...datos };

      // Remover campos que no se deben actualizar
      delete actualizacion.id;
      delete actualizacion.fecha_creacion;

      // Convertir Date a Timestamp si es necesario
      if (actualizacion.fecha_entrega_programada instanceof Date) {
        actualizacion.fecha_entrega_programada = Timestamp.fromDate(
          actualizacion.fecha_entrega_programada
        );
      }

      await updateDoc(pedidoRef, actualizacion);
      console.log(`✅ Pedido actualizado: ${id}`);
    } catch (error) {
      console.error('❌ Error actualizando pedido:', error);
      throw error;
    }
  }

  /**
   * Elimina un pedido
   */
  async eliminarPedido(id: string): Promise<void> {
    try {
      const pedidoRef = doc(db, 'pedidos', id);
      await deleteDoc(pedidoRef);
      console.log(`✅ Pedido eliminado: ${id}`);
    } catch (error) {
      console.error('❌ Error eliminando pedido:', error);
      throw error;
    }
  }

  /**
   * Desactiva un pedido (soft delete)
   */
  async desactivarPedido(id: string): Promise<void> {
    try {
      await this.actualizarPedido(id, { activo: false });
      console.log(`✅ Pedido desactivado: ${id}`);
    } catch (error) {
      console.error('❌ Error desactivando pedido:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los pedidos del día actual (sin índice compuesto)
   * Usado para generar códigos de pedido secuenciales
   * 
   * Estrategia: Obtener todos los documentos y filtrar por fecha y activo en código
   */
  async obtenerPedidosDelDia(fecha: Date = new Date()): Promise<Pedido[]> {
    try {
      console.log('\n%c═══════════════════════════════════════', 'color: green; font-weight: bold');
      console.log('%c🔍 OBTENIENDO PEDIDOS DEL DÍA', 'color: green; font-weight: bold; font-size: 14px');
      console.log('%c═══════════════════════════════════════', 'color: green; font-weight: bold');
      
      const inicioDelDia = new Date(fecha);
      inicioDelDia.setHours(0, 0, 0, 0);

      const finDelDia = new Date(fecha);
      finDelDia.setHours(23, 59, 59, 999);
      
      console.log(`📅 Buscando pedidos entre: ${inicioDelDia.toLocaleString()} y ${finDelDia.toLocaleString()}`);

      // Obtener TODOS los pedidos sin filtros para evitar índice compuesto
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef);

      const snapshot = await getDocs(q);
      
      console.log(`📦 Total documentos en colección pedidos: ${snapshot.size}`);

      const pedidosDelDia: Pedido[] = [];
      let contadorProcessados = 0;
      let contadorActivos = 0;
      let contadorFechaMatch = 0;

      snapshot.forEach((doc) => {
        contadorProcessados++;
        const data = doc.data();
        const codigo = data['codigo_pedido'] || 'SIN_CÓDIGO';
        
        // Verificar si está activo
        const esActivo = data['activo'] === true || data['activo'] === undefined;
        if (!esActivo) {
          console.log(`  ❌ [${contadorProcessados}] ${codigo} - Inactivo (activo=${data['activo']})`);
          return;
        }
        contadorActivos++;
        
        // Extraer fecha de creación
        const fechaCreacion = data['fecha_creacion']
          ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
          : new Date();

        // Verificar si está en el rango de hoy
        const estaEnRango = fechaCreacion >= inicioDelDia && fechaCreacion <= finDelDia;
        
        if (estaEnRango) {
          contadorFechaMatch++;
          console.log(`  ✅ [${contadorProcessados}] ${codigo} - MATCH (fecha: ${fechaCreacion.toLocaleString()})`);
          
          pedidosDelDia.push({
            id: doc.id,
            codigo_pedido: codigo,
            cliente_id: data['cliente_id'] || '',
            cliente_nombre: data['cliente_nombre'] || undefined,
            encomendista_nombre: data['encomendista_nombre'] || undefined,
            telefono_cliente: data['telefono_cliente'] || undefined,
            tienda_id: data['tienda_id'] || '',
            nombre_tienda: data['nombre_tienda'] || undefined,
            nombre_perfil: data['nombre_perfil'] || undefined,
            cantidad_prendas: data['cantidad_prendas'] || 0,
            costo_prendas: data['costo_prendas'] || 0,
            monto_envio: data['monto_envio'] || 0,
            total: data['total'] || 0,
            dia_entrega: data['dia_entrega'] || '',
            fecha_entrega_programada: data['fecha_entrega_programada']
              ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
              : undefined,
            hora_inicio: data['hora_inicio'] || undefined,
            hora_fin: data['hora_fin'] || undefined,
            notas: data['notas'] || undefined,
            modo: data['modo'] || 'normal',
            encomendista_id: data['encomendista_id'] || undefined,
            destino_id: data['destino_id'] || undefined,
            destino_nombre: data['destino_nombre'] || undefined,
            direccion_personalizada: data['direccion_personalizada'] || undefined,
            productos_id: data['productos_id'] || [],
            productos_codigos: data['productos_codigos'] || [],
            estado: data['estado'] || 'pendiente',
            fecha_creacion: fechaCreacion,
            created_on: data['created_on'] || undefined,
            activo: data['activo'] ?? true,
          });
        } else {
          console.log(`  ⏰ [${contadorProcessados}] ${codigo} - NO está en el rango (fecha: ${fechaCreacion.toLocaleString()})`);
        }
      });

      console.log(`\n📊 RESUMEN:`);
      console.log(`  • Total procesados: ${contadorProcessados}`);
      console.log(`  • Activos: ${contadorActivos}`);
      console.log(`  • Con fecha del día: ${contadorFechaMatch}`);
      console.log(`  • FINALES para generador de código: ${pedidosDelDia.length}`);
      
      if (pedidosDelDia.length > 0) {
        console.log(`\n📋 Códigos encontrados:`);
        pedidosDelDia.forEach((p, idx) => {
          console.log(`   ${idx + 1}. ${p.codigo_pedido}`);
        });
      }
      
      console.log('%c═══════════════════════════════════════\n', 'color: green; font-weight: bold');
      
      return pedidosDelDia;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos del día:', error);
      return [];
    }
  }

  /**
   * Obtiene pedidos por cliente
   */
  async obtenerPedidosPorCliente(clienteId: string): Promise<Pedido[]> {
    try {
      const pedidosRef = collection(db, 'pedidos');
      const q = query(
        pedidosRef,
        where('cliente_id', '==', clienteId)
      );

      const snapshot = await getDocs(q);
      const pedidos: Pedido[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        pedidos.push({
          id: doc.id,
          codigo_pedido: data['codigo_pedido'] || '',
          cliente_id: data['cliente_id'] || '',
          cliente_nombre: data['cliente_nombre'],
          encomendista_nombre: data['encomendista_nombre'],
          telefono_cliente: data['telefono_cliente'],
          tienda_id: data['tienda_id'] || '',
          nombre_tienda: data['nombre_tienda'],
          nombre_perfil: data['nombre_perfil'],
          cantidad_prendas: data['cantidad_prendas'] || 0,
          costo_prendas: data['costo_prendas'] || 0,
          monto_envio: data['monto_envio'] || 0,
          total: data['total'] || 0,
          dia_entrega: data['dia_entrega'] || '',
          fecha_entrega_programada: data['fecha_entrega_programada']
            ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
            : undefined,
          hora_inicio: data['hora_inicio'],
          hora_fin: data['hora_fin'],
          notas: data['notas'],
          modo: data['modo'] || 'normal',
          encomendista_id: data['encomendista_id'],
          destino_id: data['destino_id'],
          destino_nombre: data['destino_nombre'],
          direccion_personalizada: data['direccion_personalizada'],
          productos_id: data['productos_id'] || [],
          productos_codigos: data['productos_codigos'] || [],
          estado: data['estado'] || 'pendiente',
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
          created_on: data['created_on'],
          activo: data['activo'] ?? true,
        });
      });

      return pedidos;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos por cliente:', error);
      return [];
    }
  }

  /**
   * Obtiene todos los pedidos activos
   */
  async obtenerPedidos(): Promise<Pedido[]> {
    try {
      const pedidosRef = collection(db, 'pedidos');
      // NO FILTRAR POR ACTIVO - igual que en la web, obtener todos
      const q = query(pedidosRef);
      const snapshot = await getDocs(q);
      const pedidos: Pedido[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        let destino_nombre = data['destino_nombre'] || undefined;
        
        pedidos.push({
          id: doc.id,
          codigo_pedido: data['codigo_pedido'] || '',
          cliente_id: data['cliente_id'] || '',
          cliente_nombre: data['cliente_nombre'] || undefined,
          encomendista_nombre: data['encomendista_nombre'] || undefined,
          telefono_cliente: data['telefono_cliente'] || undefined,
          tienda_id: data['tienda_id'] || '',
          nombre_tienda: data['nombre_tienda'] || undefined,
          nombre_perfil: data['nombre_perfil'] || undefined,
          cantidad_prendas: data['cantidad_prendas'] || 0,
          costo_prendas: data['costo_prendas'] || 0,
          monto_envio: data['monto_envio'] || 0,
          total: data['total'] || 0,
          dia_entrega: data['dia_entrega'] || '',
          fecha_entrega_programada: data['fecha_entrega_programada']
            ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
            : undefined,
          hora_inicio: data['hora_inicio'] || undefined,
          hora_fin: data['hora_fin'] || undefined,
          notas: data['notas'] || undefined,
          modo: data['modo'] || 'normal',
          encomendista_id: data['encomendista_id'] || undefined,
          destino_id: data['destino_id'] || undefined,
          destino_nombre: destino_nombre,
          direccion_personalizada: data['direccion_personalizada'] || undefined,
          productos_id: data['productos_id'] || [],
          productos_codigos: data['productos_codigos'] || [],
          foto_paquete: data['foto_paquete'] || undefined,
          estado: data['estado'] || 'pendiente',
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
          created_on: data['created_on'] || undefined,
          activo: data['activo'] ?? true,
        });
      });

      // ENRIQUECER DESTINOS - JOIN CON ENCOMENDISTAS
      console.log('📋 Enriqueciendo', pedidos.length, 'pedidos con datos de destinos...');
      const pedidosEnriquecidos = await Promise.all(
        pedidos.map(async (pedido) => {
          // Si no tiene destino_nombre y es modo normal, buscar en encomendista
          if (!pedido.destino_nombre && pedido.encomendista_id) {
            console.log(`🔍 Buscando destino para pedido ${pedido.codigo_pedido}`);
            pedido.destino_nombre = await this.enriquecerDestino(pedido, pedido.encomendista_id);
          }
          return pedido;
        })
      );

      // Ordenar en memoria por fecha descendente
      return pedidosEnriquecidos.sort((a, b) => {
        const fechaB = b.fecha_creacion?.getTime() || 0;
        const fechaA = a.fecha_creacion?.getTime() || 0;
        return fechaB - fechaA;
      });
    } catch (error) {
      console.error('❌ Error obteniendo pedidos:', error);
      return [];
    }
  }

  /**
   * Cambia el estado de un pedido
   */
  async cambiarEstado(pedidoId: string, nuevoEstado: Pedido['estado']): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        estado: nuevoEstado,
        fecha_entrega: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      return false;
    }
  }

  /**
   * Marca un pedido como remunerado
   */
  async marcarComoRemunerado(pedidoId: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        estado: 'remunero',
      });
      return true;
    } catch (error) {
      console.error('❌ Error marcando como remunerado:', error);
      return false;
    }
  }

  /**
   * Elimina (desactiva) un pedido
   */
  async deletePedido(pedidoId: string): Promise<boolean> {
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        activo: false,
      });
      return true;
    } catch (error) {
      console.error('❌ Error eliminando pedido:', error);
      return false;
    }
  }

  /**
   * Determina si un pedido debe ser empacado (lógica igual que la web)
   * Retorna true si: NO está empacado, NO está cancelado Y su fecha de entrega corresponde al próximo envío
   */
  debeSerEmpacado(pedido: Pedido): boolean {
    // Si ya está empacado o cancelado, no necesita empacar
    if (pedido.estado === 'cancelado' || pedido.estado === 'empacada') return false;

    const hoy = new Date();
    const diaActual = hoy.getDay(); // 0=Domingo, 1=Lunes... 3=Miércoles, 6=Sábado

    // Obtener el día de entrega del pedido
    const fechaEntrega = pedido.fecha_entrega_programada || new Date();
    const diaEntrega = fechaEntrega.getDay();

    // Determinar cuál es el próximo envío basado en el día de hoy
    let esMiercoles = false;
    if (diaActual === 6 || diaActual === 0 || diaActual === 1 || diaActual === 2) {
      // Si hoy es Sábado, Domingo, Lunes o Martes, el próximo envío es Miércoles
      esMiercoles = true;
    } else if (diaActual === 3 || diaActual === 4 || diaActual === 5) {
      // Si hoy es Miércoles, Jueves o Viernes, el próximo envío es Sábado
      esMiercoles = false;
    }

    if (esMiercoles) {
      // Próximo envío es miércoles: incluye Miércoles (3), Jueves (4), Viernes (5)
      return [3, 4, 5].includes(diaEntrega);
    } else {
      // Próximo envío es sábado: incluye Sábado (6), Domingo (0), Lunes (1), Martes (2)
      return [6, 0, 1, 2].includes(diaEntrega);
    }
  }

  /**
   * Cuenta cuántos pedidos necesitan ser empacados
   */
  async contarPorEmpacar(): Promise<number> {
    try {
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef, where('estado', '==', 'pendiente'));
      const snapshot = await getDocs(q);

      let count = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        const pedido: Pedido = {
          id: doc.id,
          codigo_pedido: data['codigo_pedido'] || '',
          cliente_id: data['cliente_id'] || '',
          estado: data['estado'] || 'pendiente',
          fecha_creacion: data['fecha_creacion']
            ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
            : new Date(),
          fecha_entrega_programada: data['fecha_entrega_programada']
            ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
            : undefined,
        } as Pedido;

        if (this.debeSerEmpacado(pedido)) {
          count++;
        }
      });

      return count;
    } catch (error) {
      console.error('❌ Error contando pedidos por empacar:', error);
      return 0;
    }
  }
}

const pedidosServiceInstance = new PedidosService();

class PedidosServiceAux {
  /**
   * Obtiene pedidos para remunerar
   * Lógica:
   * - SÁBADO: Pedidos desde MIÉRCOLES anterior hasta HOY (estados: ENVIADO, RETIRADO, NO_RETIRADO)
   * - MIÉRCOLES: Pedidos desde SÁBADO anterior hasta HOY (estados: ENVIADO, RETIRADO, NO_RETIRADO)
   * - OTROS DÍAS: Pedidos desde último período de cobro hasta HOY
   */
  async obtenerPedidosPorRemunerar(): Promise<Pedido[]> {
    try {
      const hoy = new Date();
      const diaActual = hoy.getDay(); // 0=Domingo, 1=Lunes... 3=Miércoles, 6=Sábado

      let fechaInicio = new Date(hoy);
      fechaInicio.setHours(0, 0, 0, 0);

      // Calcular fecha de inicio según el día actual
      if (diaActual === 6) {
        // HOY es SÁBADO: mostrar desde MIÉRCOLES anterior
        const diasAtras = 3; // Sábado (6) - Miércoles (3) = 3 días
        fechaInicio.setDate(hoy.getDate() - diasAtras);
      } else if (diaActual === 3) {
        // HOY es MIÉRCOLES: mostrar desde SÁBADO anterior
        const diasAtras = 4; // Miércoles (3) - Sábado (6) = -3, pero hace una semana, entonces 4 días atrás
        fechaInicio.setDate(hoy.getDate() - diasAtras);
      } else if (diaActual > 3 && diaActual < 6) {
        // Jueves, Viernes: mostrar desde MIÉRCOLES anterior
        fechaInicio.setDate(hoy.getDate() - (diaActual - 3));
      } else {
        // Domingo, Lunes, Martes: mostrar desde SÁBADO anterior (hace 1-3 días)
        const diasAtras = diaActual === 0 ? 1 : diaActual + 1; // 0->1, 1->2, 2->3
        fechaInicio.setDate(hoy.getDate() - diasAtras);
      }

      const fechaFin = new Date(hoy);
      fechaFin.setHours(23, 59, 59, 999);

      // Estados que QUEREMOS mostrar
      const estadosPermitidos = ['enviado', 'retirado', 'no-retirado'];

      // Obtener todos los pedidos
      const pedidosRef = collection(db, 'pedidos');
      const q = query(pedidosRef);
      const snapshot = await getDocs(q);

      const pedidosFiltrados: Pedido[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const fechaCreacion = data['fecha_creacion']
          ? new Date(data['fecha_creacion'].toDate?.() || data['fecha_creacion'])
          : new Date();

        const estado = data['estado']?.toLowerCase() || '';
        const estaEnRango = fechaCreacion >= fechaInicio && fechaCreacion <= fechaFin;
        const estadoValido = estadosPermitidos.includes(estado);

        if (estaEnRango && estadoValido) {
          pedidosFiltrados.push({
            id: doc.id,
            codigo_pedido: data['codigo_pedido'] || '',
            cliente_id: data['cliente_id'] || '',
            cliente_nombre: data['cliente_nombre'] || undefined,
            encomendista_nombre: data['encomendista_nombre'] || undefined,
            telefono_cliente: data['telefono_cliente'] || undefined,
            tienda_id: data['tienda_id'] || '',
            nombre_tienda: data['nombre_tienda'] || undefined,
            nombre_perfil: data['nombre_perfil'] || undefined,
            cantidad_prendas: data['cantidad_prendas'] || 0,
            costo_prendas: data['costo_prendas'] || 0,
            monto_envio: data['monto_envio'] || 0,
            total: data['total'] || 0,
            dia_entrega: data['dia_entrega'] || '',
            fecha_entrega_programada: data['fecha_entrega_programada']
              ? new Date(data['fecha_entrega_programada'].toDate?.() || data['fecha_entrega_programada'])
              : undefined,
            hora_inicio: data['hora_inicio'] || undefined,
            hora_fin: data['hora_fin'] || undefined,
            notas: data['notas'] || undefined,
            modo: data['modo'] || 'normal',
            encomendista_id: data['encomendista_id'] || undefined,
            destino_id: data['destino_id'] || undefined,
            destino_nombre: data['destino_nombre'] || undefined,
            direccion_personalizada: data['direccion_personalizada'] || undefined,
            productos_id: data['productos_id'] || [],
            productos_codigos: data['productos_codigos'] || [],
            estado: estado as any,
            fecha_creacion: fechaCreacion,
            created_on: data['created_on'] || undefined,
            activo: data['activo'] ?? true,
          });
        }
      });

      console.log(`✅ ${pedidosFiltrados.length} pedidos para remunerar encontrados`);
      return pedidosFiltrados;
    } catch (error) {
      console.error('❌ Error obteniendo pedidos por remunerar:', error);
      return [];
    }
  }
}

export default pedidosServiceInstance;
