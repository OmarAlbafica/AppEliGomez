/**
 * ⚡ SERVICIO OPTIMIZADO DE PEDIDOS
 * 
 * Este servicio usa la API de Firebase Functions para obtener datos completos
 * en UNA SOLA LLAMADA, en lugar de múltiples queries a Firestore.
 * 
 * Mejoras de Performance:
 * - Antes: 4-8 queries Firestore por pedido (cliente, encomendista, productos, estado)
 * - Ahora: 1 llamada HTTP que retorna todo integrado
 * - Mejora: ~70-80% más rápido ⚡
 * 
 * Uso:
 *   import { pedidosServiceOptimizado } from './pedidosServiceOptimizado';
 *   const pedido = await pedidosServiceOptimizado.obtenerPedidoCompleto('PED-ID-123');
 */

import { auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';  // 🔴 Para fallback de usuario

const API_BASE_URL = 'https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2';

export interface ProductoCompleto {
  id: string;
  usuario_id?: string;
  nombre?: string;
  descripcion?: string;
  imagen_url?: string;
  precio?: number;
  codigo?: string;
  album?: string;
  [key: string]: any;
}

export interface ClienteCompleto {
  id: string;
  nombre: string;
  telefono: string;
  correo?: string;
  direccion?: string;
  activo: boolean;
  [key: string]: any;
}

export interface DestinoCompleto {
  nombre: string;
  horario_actual?: {
    dias: string[];
    hora_inicio: string;
    hora_fin: string;
  } | null;
  local?: string;
  [key: string]: any;
}

export interface EncomendistaDatos {
  id: string;
  nombre: string;
  telefono?: string;
  local?: string;
  destinos?: DestinoCompleto[];
  [key: string]: any;
}

export interface CambioEstado {
  id: string;
  estado_anterior: string;
  estado_nuevo: string;
  fecha: string | Date;
  notas: string;
  usuario_id: string;
}

export interface PedidoCompleto {
  // IDs principales
  id: string;
  codigo_pedido: string;
  
  // Estado
  estado: string;
  modo: 'normal' | 'personalizado';
  
  // Cliente
  cliente_id: string;
  cliente_datos?: {
    id: string;
    nombre: string;
    telefono?: string;
    correo?: string;
    direccion?: string;
    [key: string]: any;
  };
  telefono_cliente?: string;
  
  // Tienda
  tienda_id: string;
  nombre_tienda?: string;
  nombre_perfil?: string;
  usuario_id?: string;
  
  // Encomendista y Destino
  encomendista_id?: string;
  encomendista_datos?: {
    id: string;
    nombre: string;
    telefono?: string;
    local?: string;
    [key: string]: any;
  };
  destino_id?: string;
  destino_datos?: {
    nombre: string;
    horario_actual?: any;
    local?: string;
    [key: string]: any;
  };
  
  // Productos
  cantidad_prendas: number;
  productos_id?: string[];
  productos_codigos?: string[];
  productos_datos?: ProductoCompleto[];
  
  // Montos
  costo_prendas: number;
  monto_envio?: number;
  total: number;
  
  // Entrega
  dia_entrega: string;
  hora_inicio?: string;
  hora_fin?: string;
  fecha_entrega_programada?: any; // Puede ser Firestore timestamp o Date
  
  // Dirección personalizada (si aplica)
  direccion_personalizada?: string;
  
  // Auditoría
  fecha_creacion?: string;
  fecha_ultima_actualizacion?: string;
  created_on?: 'APP' | 'WEB';
  
  // Notas
  notas?: string;
  
  // Cambios de estado
  cambios_estado?: CambioEstado[];
  
  // Foto
  foto_paquete?: string;
  
  // Disponibilidad
  activo?: boolean;
  
  // Otros campos adicionales
  [key: string]: any;
}

class PedidosServiceOptimizado {
  /**
   * 🔧 CORRECTOR DE URLs - Arregla URLs con apiv2 → apiV2
   * Problema: La API a veces devuelve URLs con apiv2 (minúscula) en lugar de apiV2 (mayúscula V)
   */
  private corregirURLs(pedido: PedidoCompleto): PedidoCompleto {
    // Corregir foto_paquete
    if (pedido.foto_paquete && pedido.foto_paquete.includes('/apiv2/')) {
      console.log(`🔧 Corrigiendo URL de foto_paquete: apiv2 → apiV2`);
      pedido.foto_paquete = pedido.foto_paquete.replace('/apiv2/', '/apiV2/');
    }

    // Corregir URLs de productos
    if (pedido.productos_datos && Array.isArray(pedido.productos_datos)) {
      pedido.productos_datos = pedido.productos_datos.map((producto) => {
        if (producto.url_imagen && producto.url_imagen.includes('/apiv2/')) {
          console.log(`🔧 Corrigiendo URL de producto: apiv2 → apiV2`);
          producto.url_imagen = producto.url_imagen.replace('/apiv2/', '/apiV2/');
        }
        if (producto.url_thumbnail && producto.url_thumbnail.includes('/apiv2/')) {
          producto.url_thumbnail = producto.url_thumbnail.replace('/apiv2/', '/apiV2/');
        }
        return producto;
      });
    }

    return pedido;
  }

  /**
   * Convierte timestamp Firestore a Date
   */
  private convertirFirestoreTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp._seconds) {
      return new Date(timestamp._seconds * 1000);
    }
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
  }
  /**
   * Obtiene UN pedido con TODA la información integrada
   * Incluye: cliente, encomendista, destino, productos, cambios de estado
   * 
   * ⚡ Una sola llamada API = Mucho más rápido
   * 
   * @param pedidoId - ID del pedido en Firestore
   * @returns Objeto PedidoCompleto con toda la información
   */
  async obtenerPedidoCompleto(pedidoId: string): Promise<PedidoCompleto | null> {
    try {
      console.log(`[📦 PedidosServiceOptimizado] Obteniendo pedido: ${pedidoId}`);

      const response = await fetch(`${API_BASE_URL}/pedido/${pedidoId}`);

      if (!response.ok) {
        console.error(`⚠️ Error ${response.status}:`, await response.text());
        return null;
      }

      const data = await response.json() as any;

      if (!data.success) {
        console.error(`❌ Error en respuesta:`, data.error);
        return null;
      }

      console.log(`✅ Pedido obtenido completamente`, data.pedido);
      
      // 🔧 Corregir URLs que vengan mal formadas
      const pedidoCorrecto = this.corregirURLs(data.pedido as PedidoCompleto);
      
      return pedidoCorrecto;

    } catch (error) {
      console.error(`❌ Error en obtenerPedidoCompleto:`, error);
      return null;
    }
  }

  /**
   * Obtiene UN pedido por su CÓDIGO (ej: EG20260108003)
   * Primero busca el ID del pedido por código, luego obtiene todos los datos
   * 
   * ⚡ Ideal para escaneo QR - pasas el código y obtienes el pedido completo
   * 
   * @param codigoPedido - Código del pedido (ej: "EG20260108003")
   * @returns Objeto PedidoCompleto con toda la información
   */
  async obtenerPedidoPorCodigo(codigoPedido: string): Promise<PedidoCompleto | null> {
    try {
      console.log(`[📦 PedidosServiceOptimizado] Buscando pedido por código: ${codigoPedido}`);

      const response = await fetch(`${API_BASE_URL}/pedido/codigo/${codigoPedido}`);

      if (!response.ok) {
        console.error(`⚠️ Error ${response.status}:`, await response.text());
        return null;
      }

      const data = await response.json() as any;

      if (!data.success) {
        console.error(`❌ Error en respuesta:`, data.error);
        return null;
      }

      console.log(`✅ Pedido obtenido por código`, data.pedido);
      
      // 🔧 Corregir URLs que vengan mal formadas
      const pedidoCorrecto = this.corregirURLs(data.pedido as PedidoCompleto);
      
      return pedidoCorrecto;

    } catch (error) {
      console.error(`❌ Error en obtenerPedidoPorCodigo:`, error);
      return null;
    }
  }

  /**
   * Obtiene LISTA DE PEDIDOS con datos completos
   * Filtrado por estado y con paginación
   * 
   * @param estado - Estado a filtrar (ej: 'pendiente', 'enviado', 'entregado')
   * @param limite - Máximo de pedidos a obtener (default: 100)
   * @returns Array de PedidosCompletos
   */
  async obtenerPedidosPorEstado(
    estado: string,
    limite: number = 100
  ): Promise<PedidoCompleto[]> {
    try {
      console.log(`[📦 PedidosServiceOptimizado] Obteniendo ${limite} pedidos con estado: ${estado}`);

      const url = new URL(`${API_BASE_URL}/pedidos`);
      url.searchParams.append('estado', estado);
      url.searchParams.append('limite', limite.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`⚠️ Error ${response.status}:`, await response.text());
        return [];
      }

      const data = await response.json() as any;

      if (!data.success) {
        console.error(`❌ Error en respuesta:`, data.error);
        return [];
      }

      console.log(`✅ ${data.pedidos.length} pedidos obtenidos`);
      
      // 🔧 Corregir URLs en todos los pedidos
      const pedidosCorrecto = (data.pedidos as PedidoCompleto[]).map(p => this.corregirURLs(p));
      
      return pedidosCorrecto;

    } catch (error) {
      console.error(`❌ Error en obtenerPedidosPorEstado:`, error);
      return [];
    }
  }

  /**
   * Obtiene pedidos por MÚLTIPLES ESTADOS en UNA SOLA petición 🔥
   * Mucho más eficiente que hacer 3 llamadas separadas
   * 
   * @param estados - Array de estados (ej: ['enviado', 'retirado', 'no-retirado'])
   * @param limite - Máximo de pedidos a obtener (default: 200)
   * @returns Array de PedidosCompletos
   * 
   * @example
   * const pedidos = await obtenerPedidosPorEstados(['enviado', 'retirado', 'no-retirado'], 300);
   */
  async obtenerPedidosPorEstados(
    estados: string[],
    limite: number = 200
  ): Promise<PedidoCompleto[]> {
    try {
      const estadosStr = estados.join(',');
      console.log(`[📦 PedidosServiceOptimizado] Obteniendo ${limite} pedidos con estados: ${estadosStr}`);

      const url = new URL(`${API_BASE_URL}/pedidos`);
      url.searchParams.append('estado', estadosStr); // 🔥 Estados separados por comas
      url.searchParams.append('limite', limite.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`⚠️ Error ${response.status}:`, await response.text());
        return [];
      }

      const data = await response.json() as any;

      if (!data.success) {
        console.error(`❌ Error en respuesta:`, data.error);
        return [];
      }

      console.log(`✅ ${data.pedidos.length} pedidos obtenidos (estados: ${estadosStr})`);
      
      // 🔧 Corregir URLs en todos los pedidos
      const pedidosCorrecto = (data.pedidos as PedidoCompleto[]).map(p => this.corregirURLs(p));
      
      return pedidosCorrecto;

    } catch (error) {
      console.error(`❌ Error en obtenerPedidosPorEstados:`, error);
      return [];
    }
  }

  /**
   * Obtiene todos los pedidos sin filtrar por estado
   * 
   * @param limite - Máximo de pedidos a obtener (default: 100)
   * @returns Array de PedidosCompletos
   */
  async obtenerTodosPedidos(limite: number = 100): Promise<PedidoCompleto[]> {
    try {
      console.log(`[📦 PedidosServiceOptimizado] Obteniendo todos los pedidos (máx ${limite})`);

      const url = new URL(`${API_BASE_URL}/pedidos`);
      url.searchParams.append('limite', limite.toString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`⚠️ Error ${response.status}:`, await response.text());
        return [];
      }

      const data = await response.json() as any;

      if (!data.success) {
        console.error(`❌ Error en respuesta:`, data.error);
        return [];
      }

      console.log(`✅ ${data.pedidos.length} pedidos obtenidos`);
      
      // Loguear el primer pedido para verificar estructura completa
      if (data.pedidos.length > 0) {
        console.log(`📋 Estructura del primer pedido:`, {
          codigo: data.pedidos[0].codigo_pedido,
          cliente: data.pedidos[0].cliente_datos?.nombre,
          encomendista: data.pedidos[0].encomendista_datos?.nombre,
          destino: data.pedidos[0].destino_id,
          total: data.pedidos[0].total,
          estado: data.pedidos[0].estado,
          productos_count: data.pedidos[0].productos_id?.length || 0,
        });
      }
      
      // 🔧 Corregir URLs en todos los pedidos
      const pedidosCorrecto = (data.pedidos as PedidoCompleto[]).map(p => this.corregirURLs(p));
      
      return pedidosCorrecto;

    } catch (error) {
      console.error(`❌ Error en obtenerTodosPedidos:`, error);
      return [];
    }
  }

  /**
   * Cambia el estado de un pedido EN UNA SOLA LLAMADA
   * 
   * Operaciones:
   * 1. Actualiza el estado en la colección pedidos
   * 2. Crea registro en subcolección cambios_estado
   * 3. Si es estado 'empacada' y hay foto, la guarda
   * 
   * Todo en UNA transacción = Sin inconsistencias ✅
   * 
   * @param pedidoId - ID del pedido
   * @param nuevoEstado - Nuevo estado
   * @param fotoBase64 - Foto del paquete empacado (opcional)
   * @param notas - Notas sobre el cambio (opcional)
   * @returns true si el cambio fue exitoso
   */
  async cambiarEstadoPedido(
    pedidoId: string,
    nuevoEstado: string,
    fotoBase64?: string,
    notas?: string
  ): Promise<boolean> {
    try {
      // 🔴 VALIDACIÓN: Obtener usuario logueado
      let usuarioId = 'unknown';
      let usuarioEmail = 'unknown@app.com';

      console.log(`\n🔴🔴🔴 INICIANDO CAMBIAR ESTADO 🔴🔴🔴`);
      console.log(`[PASO 1] Verificando auth.currentUser...`);
      const currentUser = auth.currentUser;
      console.log(`[PASO 1] currentUser: ${currentUser ? '✅ EXISTE' : '❌ NULL'}`);
      
      if (currentUser) {
        usuarioId = currentUser.uid;
        usuarioEmail = currentUser.email || 'unknown@app.com';
        console.log(`[PASO 2] ✅ Usuario de Firebase encontrado`);
        console.log(`[PASO 2] - UID: ${usuarioId}`);
        console.log(`[PASO 2] - EMAIL: ${usuarioEmail}`);
      } else {
        console.log(`[PASO 2] ❌ Firebase currentUser es NULL`);
        console.log(`[PASO 3] Intentando obtener de AsyncStorage...`);
        const storedEmail = await AsyncStorage.getItem('@eli_gomez_current_user');
        console.log(`[PASO 3] AsyncStorage '@eli_gomez_current_user': ${storedEmail ? '✅ ENCONTRADO' : '❌ NO ENCONTRADO'}`);
        if (storedEmail) {
          usuarioEmail = storedEmail;
          console.log(`[PASO 3] Email recuperado: ${usuarioEmail}`);
        } else {
          console.error(`[PASO 3] ❌ NO HAY EMAIL EN ASYNCSTORAGE`);
        }
      }

      console.log(`\n[📋 RESUMEN USUARIO]`);
      console.log(`  Usuario ID: ${usuarioId}`);
      console.log(`  Usuario Email: ${usuarioEmail}`);
      
      console.log(`\n[🔄 CAMBIO DE ESTADO]`);
      console.log(`[📦 Pedido ID] ${pedidoId}`);
      console.log(`[🔄 Nuevo Estado] ${nuevoEstado}`);
      console.log(`[📸 Foto incluida] ${fotoBase64 ? '✅ SÍ' : '❌ NO'}`);
      if (fotoBase64) {
        console.log(`[📸 Tamaño foto] ${(fotoBase64.length / 1024).toFixed(2)} KB`);
      }

      const bodyEnvio = {
        nuevoEstado,
        foto_base64: fotoBase64 || null,
        notas: notas || '',
        usuario_id: usuarioId,
        usuario_email: usuarioEmail,
        pedidoId: pedidoId  // 🔴 IMPORTANTE: Agregamos ID al body como respaldo
      };

      const urlEndpoint = `${API_BASE_URL}/pedido/${pedidoId}/cambiar-estado`;
      console.log(`\n[📤 ENVIANDO REQUEST]`);
      console.log(`[URL] ${urlEndpoint}`);
      console.log(`[BODY] ${JSON.stringify({
        nuevoEstado,
        foto_base64: fotoBase64 ? `[BASE64-${fotoBase64.length} chars]` : null,
        notas,
        usuario_email: usuarioEmail,
        usuario_id: usuarioId,
        pedidoId
      }, null, 2)}`);

      console.log(`\n[⏳ Ejecutando fetch...]`);
      const response = await fetch(urlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyEnvio)
      });

      console.log(`[✅ Response Status] ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[❌ Error ${response.status}]`, errorText);
        return false;
      }

      const data = await response.json() as any;

      if (!data.success) {
        console.error(`[❌ Error en respuesta API]`, data.error);
        return false;
      }

      console.log(`[✅✅✅ ÉXITO! Estado actualizado a ${nuevoEstado}`);
      console.log(data);
      return true;

    } catch (error) {
      console.error(`\n[❌❌❌ ERROR CRÍTICO EN CAMBIAR ESTADO]`);
      console.error(error);
      return false;
    }
  }

  /**
   * Obtiene foto de paquete (cuando está en estado 'empacada')
   * 
   * @param pedidoId - ID del pedido
   * @returns URL de la foto o null si no existe
   */
  async obtenerFotoPaquete(pedidoId: string): Promise<string | null> {
    try {
      const url = `${API_BASE_URL}/obtenerFotoPaquete/${pedidoId}`;
      return url; // Retorna la URL directa para usar en <Image />
    } catch (error) {
      console.error(`❌ Error en obtenerFotoPaquete:`, error);
      return null;
    }
  }

  /**
   * Utilidad: Convertir cambios_estado a formato legible
   */
  formatearCambioEstado(cambio: CambioEstado): string {
    const fecha = typeof cambio.fecha === 'string' 
      ? new Date(cambio.fecha) 
      : cambio.fecha;

    return `${cambio.estado_anterior} → ${cambio.estado_nuevo} (${fecha.toLocaleDateString()})`;
  }

  /**
   * Utilidad: Obtener última actualización del pedido
   */
  obtenerUltimaActualizacion(pedido: PedidoCompleto): Date | null {
    if (!pedido.cambios_estado || pedido.cambios_estado.length === 0) {
      return null;
    }

    const ultimoCambio = pedido.cambios_estado[0];
    return typeof ultimoCambio.fecha === 'string'
      ? new Date(ultimoCambio.fecha)
      : ultimoCambio.fecha;
  }
}

export default new PedidosServiceOptimizado();
export const pedidosServiceOptimizado = new PedidosServiceOptimizado();
