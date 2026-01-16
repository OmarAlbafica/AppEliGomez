import { Pedido } from './pedidos.service';

/**
 * Helper para manejar la auditoría de cambios de estado en pedidos
 * Automáticamente guarda el email del usuario que realizó cada cambio
 */
export class PedidosAuditHelper {
  /**
   * Mapea el nombre del estado a las propiedades de auditoría correspondientes (usuario y timestamp)
   */
  private static readonly ESTADO_AUDIT_MAP: { [key: string]: { user: keyof Pedido; timestamp: keyof Pedido } } = {
    'pendiente': { user: 'estado_pendiente_user', timestamp: 'estado_pendiente_user_timestamp' },
    'empacada': { user: 'estado_empacada_user', timestamp: 'estado_empacada_user_timestamp' },
    'enviado': { user: 'estado_enviado_user', timestamp: 'estado_enviado_user_timestamp' },
    'retirado': { user: 'estado_retirado_user', timestamp: 'estado_retirado_user_timestamp' },
    'no-retirado': { user: 'estado_no_retirado_user', timestamp: 'estado_no_retirado_user_timestamp' },
    'cancelado': { user: 'estado_cancelado_user', timestamp: 'estado_cancelado_user_timestamp' },
    'retirado-local': { user: 'estado_retirado_local_user', timestamp: 'estado_retirado_local_user_timestamp' },
    'liberado': { user: 'estado_liberado_user', timestamp: 'estado_liberado_user_timestamp' },
    'reservado': { user: 'estado_reservado_user', timestamp: 'estado_reservado_user_timestamp' }
  };

  /**
   * Actualiza el pedido con la información de auditoría cuando cambia de estado
   * @param pedido El pedido a actualizar
   * @param nuevoEstado El nuevo estado
   * @param usuarioEmail El email del usuario que realiza el cambio
   * @returns El pedido actualizado con la auditoría
   */
  static registrarCambioEstado(
    pedido: Pedido,
    nuevoEstado: string,
    usuarioEmail: string | null | undefined
  ): Pedido {
    if (!usuarioEmail) {
      console.warn('No se pudo obtener el email del usuario para auditoría');
      return { ...pedido, estado: nuevoEstado as any };
    }

    const auditFields = this.ESTADO_AUDIT_MAP[nuevoEstado];
    if (!auditFields) {
      console.warn(`Estado no reconocido para auditoría: ${nuevoEstado}`);
      return { ...pedido, estado: nuevoEstado as any };
    }

    const pedidoActualizado = { ...pedido };
    const ahora = new Date().toISOString();
    
    pedidoActualizado.estado = nuevoEstado as any;
    (pedidoActualizado as any)[auditFields.user] = usuarioEmail;
    (pedidoActualizado as any)[auditFields.timestamp] = ahora;

    console.log(
      `%c✅ AUDITORÍA REGISTRADA`,
      'color: green; font-weight: bold;',
      `\nPedido: ${pedido.codigo_pedido}`,
      `\nCambio de estado: ${pedido.estado} → ${nuevoEstado}`,
      `\nUsuario: ${usuarioEmail}`,
      `\nFecha/Hora: ${ahora}`,
      `\nCampos: ${auditFields.user} + ${auditFields.timestamp}`
    );

    return pedidoActualizado;
  }

  /**
   * Obtiene el email del usuario que realizó un cambio de estado específico
   * @param pedido El pedido
   * @param estado El estado a consultar
   * @returns El email del usuario o null si no hay registro
   */
  static obtenerUsuarioDelEstado(pedido: Pedido, estado: string): string | null {
    const auditFields = this.ESTADO_AUDIT_MAP[estado];
    if (!auditFields) return null;
    return (pedido as any)[auditFields.user] || null;
  }

  /**
   * Obtiene la fecha/hora en que se realizó un cambio de estado específico
   * @param pedido El pedido
   * @param estado El estado a consultar
   * @returns ISO timestamp o null si no hay registro
   */
  static obtenerTimestampDelEstado(pedido: Pedido, estado: string): string | null {
    const auditFields = this.ESTADO_AUDIT_MAP[estado];
    if (!auditFields) return null;
    return (pedido as any)[auditFields.timestamp] || null;
  }

  /**
   * Obtiene el historial de cambios de estado del pedido
   * @param pedido El pedido
   * @returns Array con los cambios de estado registrados (usuario, estado y timestamp)
   */
  static obtenerHistorialCambios(pedido: Pedido): Array<{ estado: string; usuario: string | null; timestamp: string | null }> {
    const historial: Array<{ estado: string; usuario: string | null; timestamp: string | null }> = [];

    for (const [estado, auditFields] of Object.entries(this.ESTADO_AUDIT_MAP)) {
      const usuario = (pedido as any)[auditFields.user] || null;
      if (usuario) {
        const timestamp = (pedido as any)[auditFields.timestamp] || null;
        historial.push({ estado, usuario, timestamp });
      }
    }

    return historial;
  }

  /**
   * Verifica si un pedido ha sido modificado por un usuario específico
   * @param pedido El pedido
   * @param usuarioEmail El email del usuario
   * @returns true si el usuario ha realizado al menos un cambio en el pedido
   */
  static fueModificadoPorUsuario(pedido: Pedido, usuarioEmail: string): boolean {
    return Object.values(this.ESTADO_AUDIT_MAP).some(
      auditFields => (pedido as any)[auditFields.user] === usuarioEmail
    );
  }
}
