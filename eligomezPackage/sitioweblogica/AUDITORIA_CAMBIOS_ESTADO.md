# 📋 AUDITORÍA DE CAMBIOS DE ESTADO - DOCUMENTACIÓN

## 🎯 Objetivo
Registrar automáticamente quién (por email) realiza cada cambio de estado en un pedido, para tener un historial completo de auditoría sin mostrar estos datos en la interfaz.

## 📊 Estructura de Datos

### Campos Añadidos a Pedido
En la interfaz `Pedido` se han añadido 18 campos opcionales de auditoría (usuario + timestamp para cada estado):

```typescript
// AUDITORÍA: Guardar el usuario (email) y la fecha/hora que hizo cada cambio de estado
estado_pendiente_user?: string;              // Email del usuario que cambió a "pendiente"
estado_pendiente_user_timestamp?: string;    // ISO timestamp de cuándo cambió a "pendiente"
estado_empacada_user?: string;               // Email del usuario que cambió a "empacada"
estado_empacada_user_timestamp?: string;     // ISO timestamp de cuándo cambió a "empacada"
estado_enviado_user?: string;                // Email del usuario que cambió a "enviado"
estado_enviado_user_timestamp?: string;      // ISO timestamp de cuándo cambió a "enviado"
estado_retirado_user?: string;               // Email del usuario que cambió a "retirado"
estado_retirado_user_timestamp?: string;     // ISO timestamp de cuándo cambió a "retirado"
estado_no_retirado_user?: string;            // Email del usuario que cambió a "no-retirado"
estado_no_retirado_user_timestamp?: string;  // ISO timestamp de cuándo cambió a "no-retirado"
estado_cancelado_user?: string;              // Email del usuario que cambió a "cancelado"
estado_cancelado_user_timestamp?: string;    // ISO timestamp de cuándo cambió a "cancelado"
estado_retirado_local_user?: string;         // Email del usuario que cambió a "retirado-local"
estado_retirado_local_user_timestamp?: string; // ISO timestamp de cuándo cambió a "retirado-local"
estado_liberado_user?: string;               // Email del usuario que cambió a "liberado"
estado_liberado_user_timestamp?: string;     // ISO timestamp de cuándo cambió a "liberado"
estado_reservado_user?: string;              // Email del usuario que cambió a "reservado"
estado_reservado_user_timestamp?: string;    // ISO timestamp de cuándo cambió a "reservado"
```

**Formato de timestamps**: ISO 8601 (ej: `2025-01-12T15:30:45.123Z`)

## 🔧 Componentes Implementados

### 1. PedidosAuditHelper (`pedidos-audit.helper.ts`)
Utilidad que maneja toda la lógica de auditoría:

```typescript
class PedidosAuditHelper {
  // Registra automáticamente el cambio de estado con el email del usuario Y la fecha/hora
  static registrarCambioEstado(pedido, nuevoEstado, usuarioEmail)
  
  // Obtiene el email del usuario que cambió a un estado específico
  static obtenerUsuarioDelEstado(pedido, estado)
  
  // Obtiene la fecha/hora en que se realizó un cambio de estado específico
  static obtenerTimestampDelEstado(pedido, estado)
  
  // Obtiene el historial completo de cambios de estado (usuario + timestamp)
  static obtenerHistorialCambios(pedido)
  
  // Verifica si un usuario modificó un pedido
  static fueModificadoPorUsuario(pedido, usuarioEmail)
}
```

### 2. PedidosService Actualizado
#### Método: `actualizarPedido()`
```typescript
async actualizarPedido(pedidoOrig: Pedido): Promise<void> {
  // 1. Obtiene el usuario actual (email)
  const usuarioEmail = auth.currentUser?.email
  
  // 2. Detecta si hay cambio de estado
  if (estadoAnterior !== nuevoEstado) {
    // 3. Usa el helper para registrar la auditoría automáticamente
    pedido = PedidosAuditHelper.registrarCambioEstado(
      pedidoOrig,
      nuevoEstado,
      usuarioEmail
    )
  }
  
  // 4. Guarda en Firebase con los datos de auditoría
  await updateDoc(docRef, datosLimpios)
}
```

#### Método: `crearPedido()`
```typescript
async crearPedido(pedido): Promise<string> {
  // Cuando se crea un pedido, automáticamente se guarda:
  estado: 'pendiente',
  estado_pendiente_user: usuarioEmail // Email de quien lo crea
}
```

## 📝 Ejemplo de Uso en la Aplicación

### Caso 1: Crear un pedido
```
User: juan@example.com
Fecha/Hora: 2025-01-12T10:30:15.123Z
Acción: Crear pedido
Resultado en Firebase:
  {
    id: "PEDIDO-001",
    estado: "pendiente",
    estado_pendiente_user: "juan@example.com",
    estado_pendiente_user_timestamp: "2025-01-12T10:30:15.123Z"  ← Timestamp registrado
  }
```

### Caso 2: Cambiar estado a "enviado"
```
User: maria@example.com
Fecha/Hora: 2025-01-12T14:45:30.456Z
Acción: Cambiar estado a "enviado"
Resultado en Firebase:
  {
    id: "PEDIDO-001",
    estado: "enviado",
    estado_pendiente_user: "juan@example.com",
    estado_pendiente_user_timestamp: "2025-01-12T10:30:15.123Z",
    estado_enviado_user: "maria@example.com",
    estado_enviado_user_timestamp: "2025-01-12T14:45:30.456Z"  ← Quién + cuándo
  }
```

### Caso 3: Cambiar estado a "retirado"
```
User: carlos@example.com
Fecha/Hora: 2025-01-12T16:20:10.789Z
Acción: Cambiar estado a "retirado"
Resultado en Firebase:
  {
    id: "PEDIDO-001",
    estado: "retirado",
    estado_pendiente_user: "juan@example.com",
    estado_pendiente_user_timestamp: "2025-01-12T10:30:15.123Z",
    estado_enviado_user: "maria@example.com",
    estado_enviado_user_timestamp: "2025-01-12T14:45:30.456Z",
    estado_retirado_user: "carlos@example.com",
    estado_retirado_user_timestamp: "2025-01-12T16:20:10.789Z"  ← Quién + cuándo
  }
```

## 🔄 Flujo de Auditoría

```
┌─────────────────────────────────────────────────────────────┐
│                 Usuario realiza una acción                  │
│              (Cambiar Estado, etc.)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         OPCIÓN A: Desde Cliente Angular                     │
│         PedidosService.actualizarPedido()                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         Captura: auth.currentUser?.email                    │
│         Registra auditoría directamente en Firestore         │
│         - estado_[estado]_user: email                       │
│         - estado_[estado]_user_timestamp: ISO timestamp     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         OPCIÓN B: Desde Backend (Cloud Functions)           │
│         POST /pedido/:pedidoId/cambiar-estado               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│         Backend recibe:                                      │
│         - nuevoEstado                                        │
│         - usuario_email                                      │
│         - Automáticamente registra auditoría                │
│         - Transacción ATÓMICA en Firestore                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│      Pedido actualizado con auditoría                       │
│                                                             │
│  estado_pendiente_user: "user1@example.com"                 │
│  estado_pendiente_user_timestamp: "2025-01-12T10:30:15Z"   │
│  estado_enviado_user: "user2@example.com"                   │
│  estado_enviado_user_timestamp: "2025-01-12T14:45:30Z"     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│      Guardar en Firebase (Firestore)                        │
│      ✅ SINCRONIZADO: Cliente + Backend                     │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Integración en Componentes

### OPCIÓN A: Desde Cliente Angular (Actual)
El método `guardarCambioEstado()` ya llama a `actualizarPedido()`, por lo que **automáticamente** registra la auditoría:

```typescript
async guardarCambioEstado() {
  // El usuario selecciona un nuevo estado
  const pedidoActualizado = { ...this.pedidoSeleccionado, estado: nuevoEstado };
  
  // Llama a actualizar (que ya incluye auditoría)
  await this.pedidosService.actualizarPedido(pedidoActualizado);
  // ✅ La auditoría se registra automáticamente en el cliente
  // ✅ Se guarda en Firestore
}
```

### OPCIÓN B: Desde Backend (Cloud Functions) - RECOMENDADO
Para aplicaciones móviles o cuando necesites garantizar que el servidor registre la auditoría:

```typescript
// En la app móvil o cliente remoto
const response = await fetch(
  'https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/pedido/PEDIDO-001/cambiar-estado',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nuevoEstado: 'enviado',
      usuario_email: 'maria@example.com',  // ← Email del usuario
      notas: 'Enviado hoy',
      // foto_base64: '...' (opcional para estado empacada)
    })
  }
);

const resultado = await response.json();
// Resultado: {
//   success: true,
//   message: "Pedido actualizado a enviado",
//   pedido_id: "PEDIDO-001",
//   estado_nuevo: "enviado",
//   fecha: "2025-01-12T14:45:30.123Z"
// }

// El backend automáticamente:
// 1. Actualiza estado: "enviado"
// 2. Registra auditoría:
//    - estado_enviado_user: "maria@example.com"
//    - estado_enviado_user_timestamp: "2025-01-12T14:45:30.123Z"
// 3. Guarda en subcolección cambios_estado
// 4. TODO EN UNA TRANSACCIÓN ATÓMICA
```

**Ventaja del backend**: 
- ✅ Sincronización garantizada
- ✅ Transacción ATÓMICA (todo-o-nada)
- ✅ Auditoría controlada por el servidor
- ✅ Seguro para apps móviles

## 📊 Consultar la Auditoría

### Desde Firestore Console
1. Ir a Firebase Console
2. Abrir la colección "pedidos"
3. Buscar el pedido
4. Desplazarse hacia abajo para ver todos los campos `estado_*_user`

### Desde la Aplicación (Futuro)
Se puede crear un componente para mostrar el historial con timestamps:

```typescript
// Usando el helper
const historial = PedidosAuditHelper.obtenerHistorialCambios(pedido);
// Resultado: [
//   { estado: 'pendiente', usuario: 'juan@example.com', timestamp: '2025-01-12T10:30:15.123Z' },
//   { estado: 'enviado', usuario: 'maria@example.com', timestamp: '2025-01-12T14:45:30.456Z' },
//   { estado: 'retirado', usuario: 'carlos@example.com', timestamp: '2025-01-12T16:20:10.789Z' }
// ]

// O consultar información específica de un estado
const usuarioEnvio = PedidosAuditHelper.obtenerUsuarioDelEstado(pedido, 'enviado');
const timestampEnvio = PedidosAuditHelper.obtenerTimestampDelEstado(pedido, 'enviado');
console.log(`Enviado por ${usuarioEnvio} el ${new Date(timestampEnvio).toLocaleString('es-CL')}`);
// Output: "Enviado por maria@example.com el 12/1/2025, 14:45:30"
```

## 🔐 Consideraciones de Seguridad

- Los emails de usuarios se guardan automáticamente de `auth.currentUser?.email`
- Si no hay usuario autenticado, se guarda "desconocido"
- Los datos de auditoría son **de solo lectura** en la interfaz (no se muestran)
- Pueden consultarse desde Firebase Console para reportes
- Se pueden exportar para análisis de auditoría

## 📁 Archivos Afectados

### FrontEndEliGomez
- ✅ `src/app/service/pedidos/pedidos.service.ts` - Actualizado
- ✅ `src/app/service/pedidos/pedidos-audit.helper.ts` - Nuevo
- ✅ `src/app/modules/pedidos/pedidos.component.ts` - Funciona automáticamente
- ✅ `src/app/modules/envios-por-encomienda/envios-por-encomienda.component.ts` - Funciona automáticamente

### AppEliGomez
- ✅ `eligomezPackage/sitioweblogica/src/app/service/pedidos/pedidos.service.ts` - Actualizado
- ✅ `eligomezPackage/sitioweblogica/src/app/service/pedidos/pedidos-audit.helper.ts` - Nuevo

## 🔄 Estados Auditados

Cada estado tiene 2 campos asociados (usuario + timestamp):

| Estado | Campo Usuario | Campo Timestamp |
|--------|--------------|-----------------|
| pendiente | `estado_pendiente_user` | `estado_pendiente_user_timestamp` |
| empacada | `estado_empacada_user` | `estado_empacada_user_timestamp` |
| enviado | `estado_enviado_user` | `estado_enviado_user_timestamp` |
| retirado | `estado_retirado_user` | `estado_retirado_user_timestamp` |
| no-retirado | `estado_no_retirado_user` | `estado_no_retirado_user_timestamp` |
| cancelado | `estado_cancelado_user` | `estado_cancelado_user_timestamp` |
| retirado-local | `estado_retirado_local_user` | `estado_retirado_local_user_timestamp` |
| liberado | `estado_liberado_user` | `estado_liberado_user_timestamp` |
| reservado | `estado_reservado_user` | `estado_reservado_user_timestamp` |

## 📋 Checklist de Verificación

- ✅ Interfaz Pedido actualizada con campos de auditoría (usuario + timestamp)
- ✅ Helper de auditoría creado con método obtenerTimestampDelEstado()
- ✅ método actualizarPedido() registra auditoría con timestamp
- ✅ método crearPedido() registra auditoría inicial con timestamp
- ✅ Componentes usando automáticamente auditoría
- ✅ Cambios aplicados a FrontEndEliGomez
- ✅ Cambios aplicados a AppEliGomez
- ✅ Todos los estados cubiertos con 2 campos cada uno (18 campos totales)
- ✅ Manejo de usuarios no autenticados
- ✅ Timestamps en formato ISO 8601 para fácil parsing

## 🚀 Próximas Mejoras

- [ ] Crear pantalla de "Historial de Cambios" con timestamp y usuario
- [ ] Mostrar en formato legible (ej: "Enviado por maria@example.com el 12 de enero de 2025 a las 14:45")
- [ ] Agregar filtros de auditoría en reportes (por usuario, por fecha, por estado)
- [ ] Enviar notificaciones cuando cambia el estado (incluir nombre del usuario)
- [ ] Crear log de auditoría en tabla separada para análisis histórico
- [ ] Implementar permisos basados en cambios de estado realizados
- [ ] Exportar historial de auditoría a CSV con timestamps
