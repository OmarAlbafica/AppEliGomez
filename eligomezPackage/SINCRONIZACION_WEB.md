# 🔄 Sincronización App Móvil con Web

## Fecha: 9 de Enero de 2026

### 📋 Cambios necesarios identificados

#### 1. **CrearPedidoScreen**
Actualizar con la lógica del web:
- ✅ Modos: normal y personalizado
- ✅ Búsqueda de clientes con filtrado
- ✅ Favoritos de pedidos
- ✅ Selección de productos con imagen
- ✅ Búsqueda de encomendistas y destinos
- ✅ Cálculo de fechas disponibles
- ✅ Guardado de múltiples pedidos a la vez

#### 2. **Estructura de Servicios**
Web tiene:
```
/service
  /auth
  /clientes
  /encomendistas
  /pedidos
  /productos
  /tiendas
  /favoritos
```

Móvil tiene:
```
/services
  authService.ts
  clientesService.ts
  encomendistasService.ts
  pedidosService.ts
  (falta: productosService, tiendasService, favoritosService)
```

#### 3. **Modelos/Interfaces necesarias**
- Producto
- Tienda
- FavoritoPedido
- DestinoEncomendista (ampliada)

#### 4. **Funcionalidades faltantes**
- OCR/Extracción de precios desde imagen
- Búsqueda/Filtrado mejorado
- Gestión de favoritos
- Productos y tiendas
- Cálculo de fechas disponibles por destino

---

### 🚀 Plan de Acción

1. Crear servicios faltantes
2. Actualizar interfaces de datos
3. Reescribir pantallas principales
4. Sincronizar lógica de negocio

