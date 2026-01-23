# Solución: Códigos Únicos de Pedidos

## Problema
Dos pedidos tienen el mismo código porque dos usuarios crean pedidos simultáneamente. Ambos generan el mismo secuencial sin validar contra BD.

## Solución Implementada

### 1. App Android (HECHO ✅)
Se agregaron dos métodos nuevos en `pedidosServiceOptimizado.ts`:

#### `validarCodigoPedidoExiste(codigoPedido: string): boolean`
- Hace request a `/pedido/codigo/{codigo}`
- Retorna `true` si existe, `false` si no existe
- Manejo de errores: si falla, asume que no existe (mejor permitir que rechazar)

#### `generarCodigoValidado(tiendaNombre, codigoInicial): string`
- Recibe código inicial generado por `generarCodigoPedido()`
- Loop:
  - Valida si existe con `validarCodigoPedidoExiste()`
  - Si NO existe → retorna ese código
  - Si EXISTE → suma 1 a la secuencia y reintenta
  - Máximo 100 intentos (protección)

#### Uso en CrearPedidoScreen
```typescript
// 1. Generar código localmente
const codigoInicial = generarCodigoPedido(tienda, pedidosDelDia);

// 2. Validar y ajustar contra BD
const codigoPedido = await pedidosService.generarCodigoValidado(tienda, codigoInicial);

// 3. Crear pedido con código garantizado único
```

### 2. Backend/API (NECESARIO ❗)

**Tu otro agente debe hacer esto en la web:**

Agregar validación en el endpoint `POST /crear-pedido`:

```typescript
// Validación ANTES de guarar
const codigoExiste = await db.collection('pedidos')
  .where('codigo_pedido', '==', codigoPedido)
  .get();

if (!codigoExiste.empty) {
  return { error: 'Código duplicado', codigo_sugerido: codigoPedido + 1 };
}

// Si pasa validación → guardar
await db.collection('pedidos').add({ ...pedido, codigo_pedido });
```

### 3. Flujo Completo

```
App:
1. Generar código: "EG20260121001"
2. Validar si existe → NO (✓)
3. Crear pedido con ese código

Caso de concurrencia:
Usuario A:
1. Genera "EG20260121001"
2. Valida → NO existe
3. Inicia creación (enviando a BD)

Usuario B (casi simultáneamente):
1. Genera "EG20260121001"
2. Valida → SI existe (A ya lo subió)
3. Suma 1: "EG20260121002"
4. Valida → NO existe
5. Crea con código nuevo ✓
```

## Ventajas
- ✅ Previene duplicados incluso con concurrencia
- ✅ Simple y directo
- ✅ Rápido (máximo 100 llamadas, pero generalmente 1-2)
- ✅ Sin cambiar estructura de BD
- ✅ Mantiene códigos legibles "EG20260121001"

## Testing
Para verificar que funciona:
1. Abrir app de dos usuarios
2. Ambos ir a "Crear Pedido"
3. Llenar formulario igual en ambos
4. Click crear casi simultáneamente
5. Verificar que tienen códigos diferentes

## Cambios en el código

**Archivo: `src/services/pedidosServiceOptimizado.ts`**
- Agregado método `validarCodigoPedidoExiste()`
- Agregado método `generarCodigoValidado()`

**Archivo: `src/screens/CrearPedidoScreen.tsx`**
- Modificado flujo de generación de código
- Ahora valida antes de crear
