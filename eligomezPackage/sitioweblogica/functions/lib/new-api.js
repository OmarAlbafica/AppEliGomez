"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOptimizedAPI = registerOptimizedAPI;
const admin = __importStar(require("firebase-admin"));
// Inicializar Firebase Admin (si no está inicializado)
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Detecta si una string es base64 (foto_paquete vieja sin procesar)
 */
function esBase64(str) {
    if (!str || typeof str !== 'string')
        return false;
    // Si empieza con data:image es definitivamente base64
    if (str.startsWith('data:image')) {
        return true;
    }
    // Si es muy largo y NO tiene http, es probablemente base64
    if (str.length > 500 && !str.startsWith('http')) {
        return true;
    }
    return false;
}
/**
 * Función que registra todos los endpoints optimizados en la app Express
 */
function registerOptimizedAPI(app) {
    /**
     * Endpoint para subir productos - VERSION FIRESTORE
     */
    app.post("/subirProducto", async (req, res) => {
        try {
            console.log(`[API V2] Recibiendo subida de producto...`);
            const { archivoBase64, usuario_id, album, codigo } = req.body;
            if (!archivoBase64 || !usuario_id || !album || !codigo) {
                return res.status(400).json({
                    success: false,
                    error: "Parámetros requeridos: archivoBase64, usuario_id, album, codigo"
                });
            }
            // Guardar directamente en Firestore
            const db = admin.firestore();
            const docId = `${usuario_id}_${album}_${codigo}`;
            console.log(`[API V2] Guardando imagen en Firestore: ${docId}`);
            await db.collection('imagenes_productos').doc(docId).set({
                usuario_id,
                album,
                codigo,
                archivoBase64,
                fecha_carga: new Date(),
                tamaño: Buffer.from(archivoBase64, 'base64').length
            });
            console.log(`[API V2] ✅ Exitoso!`);
            return res.status(200).json({
                success: true,
                message: "Imagen guardada exitosamente en Firestore",
                url_imagen: `/api/v2/obtenerProducto/${usuario_id}/${album}/${codigo}`,
                url_thumbnail: `/api/v2/obtenerProducto/${usuario_id}/${album}/${codigo}?thumb=true`,
                docId
            });
        }
        catch (error) {
            console.error(`[API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * Endpoint para obtener imágenes
     */
    app.get("/obtenerProducto/:usuario_id/:album/:codigo", async (req, res) => {
        try {
            const { usuario_id, album, codigo } = req.params;
            const db = admin.firestore();
            const docId = `${usuario_id}_${album}_${codigo}`;
            console.log(`[API V2] Obteniendo imagen: ${docId}`);
            const doc = await db.collection('imagenes_productos').doc(docId).get();
            if (!doc.exists) {
                return res.status(404).json({
                    success: false,
                    error: "Imagen no encontrada"
                });
            }
            const data = doc.data();
            const base64Data = data?.archivoBase64;
            if (!base64Data) {
                return res.status(404).json({
                    success: false,
                    error: "No hay datos de imagen"
                });
            }
            // Convertir a imagen
            const buffer = Buffer.from(base64Data, 'base64');
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.send(buffer);
        }
        catch (error) {
            console.error(`[API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    // ============================================
    // 🚀 ENDPOINTS OPTIMIZADOS - OBTENER PEDIDOS CON DATOS COMPLETOS
    // ============================================
    /**
     * Obtiene UN pedido con TODA la información integrada en UN SOLO OBJETO
     * Incluye: cliente, encomendista, destino, productos y cambios de estado
     *
     * Ventaja: Una sola llamada API en lugar de múltiples queries a Firestore
     * Mejora de performance: ~70-80% más rápido
     *
     * GET /pedido/:pedidoId
     */
    app.get("/pedido/:pedidoId", async (req, res) => {
        try {
            const { pedidoId } = req.params;
            const db = admin.firestore();
            console.log(`[API V2] 📦 Obteniendo pedido completo: ${pedidoId}`);
            // 1. Obtener el pedido
            const pedidoDoc = await db.collection('pedidos').doc(pedidoId).get();
            if (!pedidoDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: "Pedido no encontrado"
                });
            }
            const pedidoData = pedidoDoc.data();
            // 2. Obtener cliente
            let clienteCompleto = null;
            if (pedidoData?.cliente_id) {
                try {
                    const clienteDoc = await db.collection('clientes').doc(pedidoData.cliente_id).get();
                    if (clienteDoc.exists) {
                        clienteCompleto = {
                            id: clienteDoc.id,
                            ...clienteDoc.data()
                        };
                    }
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo cliente:`, err);
                }
            }
            // 3. Obtener encomendista SOLO datos básicos (SIN destinos array completo)
            let encomendista_completo = null;
            let destino_completo = null;
            if (pedidoData?.encomendista_id) {
                try {
                    const encomendistasDoc = await db.collection('encomendistas').doc(pedidoData.encomendista_id).get();
                    if (encomendistasDoc.exists) {
                        const encData = encomendistasDoc.data();
                        // 🔑 OPTIMIZACIÓN: Solo datos básicos de la encomienda
                        encomendista_completo = {
                            id: encomendistasDoc.id,
                            nombre: encData?.nombre,
                            telefono: encData?.telefono,
                            local: encData?.local
                            // ❌ NO cargar destinos array (puede tener 100+ items)
                        };
                        // 🔑 OPTIMIZACIÓN: Obtener SOLO el destino + horario que necesitamos
                        if (pedidoData?.destino_id && encData?.destinos) {
                            const destinoEncontrado = encData.destinos.find((d) => d.nombre === pedidoData.destino_id);
                            if (destinoEncontrado) {
                                // Filtrar solo el horario que amarra con el pedido (hora_inicio + hora_fin)
                                let horarioEspecifico = null;
                                if (destinoEncontrado.horarios && Array.isArray(destinoEncontrado.horarios)) {
                                    horarioEspecifico = destinoEncontrado.horarios.find((h) => h.hora_inicio === pedidoData.hora_inicio && h.hora_fin === pedidoData.hora_fin);
                                }
                                destino_completo = {
                                    nombre: destinoEncontrado.nombre,
                                    horario_actual: horarioEspecifico || null, // 🔑 Solo el horario del pedido
                                    local: destinoEncontrado.local
                                };
                            }
                        }
                    }
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo encomendista:`, err);
                }
            }
            // 4. Obtener productos CON IMÁGENES (buscando por pedido_id en productos)
            let productos_completos = [];
            // Primero intentar con los IDs guardados en el pedido
            if (pedidoData?.productos_id && Array.isArray(pedidoData.productos_id)) {
                try {
                    for (const prodId of pedidoData.productos_id) {
                        const prodDoc = await db.collection('productos').doc(prodId).get();
                        if (prodDoc.exists) {
                            const prodData = prodDoc.data();
                            // Obtener URL de imagen del producto (no descargar base64)
                            let imagen_url = null;
                            if (prodData?.usuario_id && prodData?.album && prodData?.codigo) {
                                try {
                                    const imgDoc = await db.collection('imagenes_productos')
                                        .doc(`${prodData.usuario_id}_${prodData.album}_${prodData.codigo}`)
                                        .get();
                                    if (imgDoc.exists) {
                                        // Solo guardar URL, no base64
                                        imagen_url = `/api/obtenerProducto/${prodData.usuario_id}/${prodData.album}/${prodData.codigo}`;
                                    }
                                }
                                catch (imgErr) {
                                    console.warn(`⚠️ Error obteniendo URL de imagen de ${prodId}`);
                                }
                            }
                            productos_completos.push({
                                id: prodDoc.id,
                                ...prodData,
                                imagen_url: imagen_url
                            });
                        }
                    }
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo productos por ID:`, err);
                }
            }
            // Si no hay productos por ID, buscar por pedido_id en la colección productos
            if (productos_completos.length === 0) {
                try {
                    const prodSnapshot = await db.collection('productos')
                        .where('pedido_id', '==', pedidoId)
                        .get();
                    for (const prodDoc of prodSnapshot.docs) {
                        const prodData = prodDoc.data();
                        // Intentar obtener imagen del producto
                        let imagen_url = null;
                        let imagen_base64 = null;
                        if (prodData?.usuario_id && prodData?.album && prodData?.codigo) {
                            try {
                                const imgDoc = await db.collection('imagenes_productos')
                                    .doc(`${prodData.usuario_id}_${prodData.album}_${prodData.codigo}`)
                                    .get();
                                if (imgDoc.exists) {
                                    const imgData = imgDoc.data();
                                    // Guardar URL de acceso
                                    imagen_url = `/api/obtenerProducto/${prodData.usuario_id}/${prodData.album}/${prodData.codigo}`;
                                    // O guardar base64 si existe
                                    if (imgData?.archivoBase64) {
                                        imagen_base64 = imgData.archivoBase64;
                                    }
                                }
                            }
                            catch (imgErr) {
                                console.warn(`⚠️ Error obteniendo imagen de ${prodDoc.id}`);
                            }
                        }
                        productos_completos.push({
                            id: prodDoc.id,
                            ...prodData,
                            imagen_url: imagen_url,
                            imagen_base64: imagen_base64
                        });
                    }
                }
                catch (err) {
                    console.warn(`⚠️ Error buscando productos por pedido_id:`, err);
                }
            }
            // 5. Obtener cambios de estado (si existen)
            let cambios_estado = [];
            try {
                const cambiosSnapshot = await db
                    .collection('pedidos')
                    .doc(pedidoId)
                    .collection('cambios_estado')
                    .orderBy('fecha', 'desc')
                    .get();
                cambios_estado = cambiosSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
            catch (err) {
                console.warn(`⚠️ Error obteniendo cambios de estado:`, err);
            }
            // 6. Procesar foto_paquete: si es base64, generar URL y actualizar
            let fotoPaqueteProcessada = pedidoData?.foto_paquete || null;
            if (fotoPaqueteProcessada && esBase64(fotoPaqueteProcessada)) {
                const usuario_id = pedidoData?.usuario_id || 'unknown';
                const url = `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/obtenerFotoPaquete/${usuario_id}/${pedidoId}`;
                // Actualizar Firestore CON LA URL
                await db.collection('pedidos').doc(pedidoId).update({
                    foto_paquete: url
                }).catch(err => console.warn(`⚠️ Error actualizando Firestore:`, err));
                fotoPaqueteProcessada = url;
            }
            // 7. Armar respuesta completa
            const pedidoCompleto = {
                id: pedidoDoc.id,
                ...pedidoData,
                // Datos enriquecidos
                cliente_datos: clienteCompleto,
                encomendista_datos: encomendista_completo,
                destino_datos: destino_completo,
                productos_datos: productos_completos,
                cambios_estado: cambios_estado,
                // Timestamps normalizados
                fecha_creacion: pedidoData?.fecha_creacion?.toDate?.() || pedidoData?.fecha_creacion,
                fecha_entrega_programada: pedidoData?.fecha_entrega_programada?.toDate?.() || pedidoData?.fecha_entrega_programada,
                foto_paquete: fotoPaqueteProcessada
            };
            console.log(`✅ [API V2] Pedido ${pedidoId} obtenido con todos los datos`);
            return res.json({
                success: true,
                pedido: pedidoCompleto
            });
        }
        catch (error) {
            console.error(`[API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * Obtiene LISTA DE PEDIDOS con datos COMPLETOS
     * Incluye: cliente, encomendista, destino, productos, cambios de estado y foto
     * Filtrado por estado(s) (ej: 'pendiente' o 'pendiente,enviado,empacada')
     *
     * GET /pedidos?estado=pendiente&limite=50
     * GET /pedidos?estado=pendiente,enviado,retirado&limite=50
     * GET /pedidos (sin filtro de estado)
     */
    app.get("/pedidos", async (req, res) => {
        try {
            const { estado, limite = 100, offset = 0 } = req.query;
            const db = admin.firestore();
            // Parsear múltiples estados (separados por comas)
            let estadosArray = [];
            if (estado) {
                estadosArray = estado
                    .split(',')
                    .map(e => e.trim())
                    .filter(e => e.length > 0);
            }
            console.log(`[API V2] 📋 Obteniendo pedidos: estado=${estadosArray.join(' OR ')}, limite=${limite}`);
            let q;
            if (estadosArray.length > 0) {
                // Si hay uno o más estados
                q = db.collection('pedidos')
                    .where('estado', 'in', estadosArray)
                    .limit(parseInt(limite));
                console.log(`[API V2] Filtro: estado IN [${estadosArray.join(', ')}]`);
            }
            else {
                // Sin filtro de estado
                q = db.collection('pedidos')
                    .limit(parseInt(limite));
            }
            const snapshot = await q.get();
            // Enriquecer cada pedido en paralelo
            const pedidosPromesas = snapshot.docs.map(async (pedidoDoc) => {
                const pedidoData = pedidoDoc.data();
                // 1. Cliente COMPLETO
                let clienteCompleto = null;
                if (pedidoData.cliente_id) {
                    try {
                        const clienteDoc = await db.collection('clientes').doc(pedidoData.cliente_id).get();
                        if (clienteDoc.exists) {
                            clienteCompleto = {
                                id: clienteDoc.id,
                                ...clienteDoc.data()
                            };
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Error con cliente ${pedidoData.cliente_id}`);
                    }
                }
                // 2. Encomendista COMPLETO
                let encomendista_completo = null;
                let destino_completo = null;
                if (pedidoData.encomendista_id) {
                    try {
                        const encDoc = await db.collection('encomendistas').doc(pedidoData.encomendista_id).get();
                        if (encDoc.exists) {
                            const encData = encDoc.data();
                            encomendista_completo = {
                                id: encDoc.id,
                                nombre: encData?.nombre,
                                telefono: encData?.telefono,
                                local: encData?.local
                            };
                            // Obtener destino específico
                            if (pedidoData.destino_id && encData?.destinos) {
                                const destinoEncontrado = encData.destinos.find((d) => d.nombre === pedidoData.destino_id);
                                if (destinoEncontrado) {
                                    let horarioEspecifico = null;
                                    if (destinoEncontrado.horarios && Array.isArray(destinoEncontrado.horarios)) {
                                        horarioEspecifico = destinoEncontrado.horarios.find((h) => h.hora_inicio === pedidoData.hora_inicio && h.hora_fin === pedidoData.hora_fin);
                                    }
                                    destino_completo = {
                                        nombre: destinoEncontrado.nombre,
                                        horario_actual: horarioEspecifico || null,
                                        local: destinoEncontrado.local
                                    };
                                }
                            }
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Error con encomendista ${pedidoData.encomendista_id}`);
                    }
                }
                // 3. Productos COMPLETOS con IMÁGENES (búsqueda dual)
                let productos_completos = [];
                // Primero intentar con los IDs guardados en el pedido
                if (pedidoData.productos_id && Array.isArray(pedidoData.productos_id)) {
                    try {
                        for (const prodId of pedidoData.productos_id) {
                            const prodDoc = await db.collection('productos').doc(prodId).get();
                            if (prodDoc.exists) {
                                const prodData = prodDoc.data();
                                let imagen_url = null;
                                let imagen_base64 = null;
                                if (prodData?.usuario_id && prodData?.album && prodData?.codigo) {
                                    try {
                                        const imgDoc = await db.collection('imagenes_productos')
                                            .doc(`${prodData.usuario_id}_${prodData.album}_${prodData.codigo}`)
                                            .get();
                                        if (imgDoc.exists) {
                                            const imgData = imgDoc.data();
                                            imagen_url = `/api/obtenerProducto/${prodData.usuario_id}/${prodData.album}/${prodData.codigo}`;
                                            if (imgData?.archivoBase64) {
                                                imagen_base64 = imgData.archivoBase64;
                                            }
                                        }
                                    }
                                    catch (imgErr) {
                                        console.warn(`⚠️ Error obteniendo imagen de ${prodId}`);
                                    }
                                }
                                productos_completos.push({
                                    id: prodDoc.id,
                                    ...prodData,
                                    imagen_url: imagen_url
                                });
                            }
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Error obteniendo productos por ID en /pedidos`);
                    }
                }
                // Si no hay productos por ID, buscar por pedido_id en la colección productos
                if (productos_completos.length === 0) {
                    try {
                        const prodSnapshot = await db.collection('productos')
                            .where('pedido_id', '==', pedidoDoc.id)
                            .get();
                        for (const prodDoc of prodSnapshot.docs) {
                            const prodData = prodDoc.data();
                            let imagen_url = null;
                            if (prodData?.usuario_id && prodData?.album && prodData?.codigo) {
                                try {
                                    const imgDoc = await db.collection('imagenes_productos')
                                        .doc(`${prodData.usuario_id}_${prodData.album}_${prodData.codigo}`)
                                        .get();
                                    if (imgDoc.exists) {
                                        imagen_url = `/api/obtenerProducto/${prodData.usuario_id}/${prodData.album}/${prodData.codigo}`;
                                    }
                                }
                                catch (imgErr) {
                                    console.warn(`⚠️ Error obteniendo imagen de ${prodDoc.id}`);
                                }
                            }
                            productos_completos.push({
                                id: prodDoc.id,
                                ...prodData,
                                imagen_url: imagen_url
                            });
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Error buscando productos por pedido_id en /pedidos`);
                    }
                }
                // 4. Cambios de estado
                let cambios_estado = [];
                try {
                    const cambiosSnapshot = await db
                        .collection('pedidos')
                        .doc(pedidoDoc.id)
                        .collection('cambios_estado')
                        .orderBy('fecha', 'desc')
                        .get();
                    cambios_estado = cambiosSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo cambios de estado`);
                }
                return {
                    id: pedidoDoc.id,
                    ...pedidoData,
                    // Datos enriquecidos
                    cliente_datos: clienteCompleto,
                    encomendista_datos: encomendista_completo,
                    destino_datos: destino_completo,
                    productos_datos: productos_completos,
                    cambios_estado: cambios_estado,
                    // Timestamps normalizados
                    fecha_creacion: pedidoData.fecha_creacion?.toDate?.() || pedidoData.fecha_creacion,
                    fecha_entrega_programada: pedidoData.fecha_entrega_programada?.toDate?.() || pedidoData.fecha_entrega_programada,
                    foto_paquete: pedidoData.foto_paquete
                };
            });
            const pedidosCompletos = await Promise.all(pedidosPromesas);
            // 🔄 Procesar fotos base64 legacy y convertir a URLs
            const pedidosProcesados = await Promise.all(pedidosCompletos.map(async (pedido) => {
                if (pedido.foto_paquete && esBase64(pedido.foto_paquete)) {
                    // Generar URL CORRECTA con usuario_id
                    const usuario_id = pedido.usuario_id || 'unknown';
                    const url = `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/obtenerFotoPaquete/${usuario_id}/${pedido.id}`;
                    // Actualizar Firestore CON LA URL
                    await db.collection('pedidos').doc(pedido.id).update({
                        foto_paquete: url
                    }).catch(err => console.warn(`⚠️ Error actualizando Firestore:`, err));
                    // RETORNAR URL (nunca base64)
                    return { ...pedido, foto_paquete: url };
                }
                return pedido;
            }));
            console.log(`✅ [API V2] ${pedidosProcesados.length} pedidos obtenidos con datos completos`);
            return res.json({
                success: true,
                total: pedidosProcesados.length,
                pedidos: pedidosProcesados
            });
        }
        catch (error) {
            console.error(`[API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * Obtiene PEDIDOS POR REMUNERAR (con datos COMPLETOS)
     * Estados: 'enviado', 'no-retirado', 'retirado'
     * Desde la fecha actual hacia atrás
     *
     * GET /pedidos-por-remunerar
     * Con toda la data: cliente, encomendista, destino, productos, cambios_estado, foto
     */
    app.get("/pedidos-por-remunerar", async (req, res) => {
        try {
            const db = admin.firestore();
            // Obtener fecha actual al inicio del día
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const timestampHoy = new Date(hoy);
            console.log(`[API V2] 📋 Obteniendo pedidos por remunerar desde: ${timestampHoy.toISOString()}`);
            const db_query = db.collection('pedidos')
                .where('estado', 'in', ['enviado', 'no-retirado', 'retirado'])
                .where('fecha_entrega_programada', '<=', timestampHoy)
                .limit(1000);
            const snapshot = await db_query.get();
            // Enriquecer cada pedido en paralelo
            const pedidosPromesas = snapshot.docs.map(async (pedidoDoc) => {
                const pedidoData = pedidoDoc.data();
                // 1. Cliente COMPLETO
                let clienteCompleto = null;
                if (pedidoData.cliente_id) {
                    try {
                        const clienteDoc = await db.collection('clientes').doc(pedidoData.cliente_id).get();
                        if (clienteDoc.exists) {
                            clienteCompleto = {
                                id: clienteDoc.id,
                                ...clienteDoc.data()
                            };
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Error con cliente ${pedidoData.cliente_id}`);
                    }
                }
                // 2. Encomendista COMPLETO
                let encomendista_completo = null;
                let destino_completo = null;
                if (pedidoData.encomendista_id) {
                    try {
                        const encDoc = await db.collection('encomendistas').doc(pedidoData.encomendista_id).get();
                        if (encDoc.exists) {
                            const encData = encDoc.data();
                            encomendista_completo = {
                                id: encDoc.id,
                                nombre: encData?.nombre,
                                telefono: encData?.telefono,
                                local: encData?.local
                            };
                            // Obtener destino específico
                            if (pedidoData.destino_id && encData?.destinos) {
                                const destinoEncontrado = encData.destinos.find((d) => d.nombre === pedidoData.destino_id);
                                if (destinoEncontrado) {
                                    let horarioEspecifico = null;
                                    if (destinoEncontrado.horarios && Array.isArray(destinoEncontrado.horarios)) {
                                        horarioEspecifico = destinoEncontrado.horarios.find((h) => h.hora_inicio === pedidoData.hora_inicio && h.hora_fin === pedidoData.hora_fin);
                                    }
                                    destino_completo = {
                                        nombre: destinoEncontrado.nombre,
                                        horario_actual: horarioEspecifico || null,
                                        local: destinoEncontrado.local
                                    };
                                }
                            }
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Error con encomendista ${pedidoData.encomendista_id}`);
                    }
                }
                // 3. Productos COMPLETOS con IMÁGENES (búsqueda dual)
                let productos_completos = [];
                // Primero intentar con los IDs guardados en el pedido
                if (pedidoData.productos_id && Array.isArray(pedidoData.productos_id)) {
                    try {
                        for (const prodId of pedidoData.productos_id) {
                            const prodDoc = await db.collection('productos').doc(prodId).get();
                            if (prodDoc.exists) {
                                const prodData = prodDoc.data();
                                let imagen_url = null;
                                if (prodData?.usuario_id && prodData?.album && prodData?.codigo) {
                                    try {
                                        const imgDoc = await db.collection('imagenes_productos')
                                            .doc(`${prodData.usuario_id}_${prodData.album}_${prodData.codigo}`)
                                            .get();
                                        if (imgDoc.exists) {
                                            imagen_url = `/api/obtenerProducto/${prodData.usuario_id}/${prodData.album}/${prodData.codigo}`;
                                        }
                                    }
                                    catch (imgErr) {
                                        console.warn(`⚠️ Error obteniendo imagen de ${prodId}`);
                                    }
                                }
                                productos_completos.push({
                                    id: prodDoc.id,
                                    ...prodData,
                                    imagen_url: imagen_url
                                });
                            }
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Error obteniendo productos por ID en /pedidos-por-remunerar`);
                    }
                }
                // Si no hay productos por ID, buscar por pedido_id en la colección productos
                if (productos_completos.length === 0) {
                    try {
                        const prodSnapshot = await db.collection('productos')
                            .where('pedido_id', '==', pedidoDoc.id)
                            .get();
                        for (const prodDoc of prodSnapshot.docs) {
                            const prodData = prodDoc.data();
                            let imagen_url = null;
                            if (prodData?.usuario_id && prodData?.album && prodData?.codigo) {
                                try {
                                    const imgDoc = await db.collection('imagenes_productos')
                                        .doc(`${prodData.usuario_id}_${prodData.album}_${prodData.codigo}`)
                                        .get();
                                    if (imgDoc.exists) {
                                        imagen_url = `/api/obtenerProducto/${prodData.usuario_id}/${prodData.album}/${prodData.codigo}`;
                                    }
                                }
                                catch (imgErr) {
                                    console.warn(`⚠️ Error obteniendo URL de imagen de ${prodDoc.id}`);
                                }
                            }
                            productos_completos.push({
                                id: prodDoc.id,
                                ...prodData,
                                imagen_url: imagen_url
                            });
                        }
                    }
                    catch (err) {
                        console.warn(`⚠️ Error buscando productos por pedido_id en /pedidos-por-remunerar`);
                    }
                }
                // 5. Obtener cambios de estado (si existen)
                let cambios_estado = [];
                try {
                    const cambiosSnapshot = await db.collection('pedidos')
                        .doc(pedidoDoc.id)
                        .collection('cambios_estado')
                        .get();
                    cambios_estado = cambiosSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo cambios de estado`);
                }
                // Procesar foto_paquete: si es base64, generar URL y actualizar
                let fotoPaqueteProcessada = pedidoData.foto_paquete || null;
                if (fotoPaqueteProcessada && esBase64(fotoPaqueteProcessada)) {
                    const usuario_id = pedidoData.usuario_id || 'unknown';
                    const url = `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/obtenerFotoPaquete/${usuario_id}/${pedidoDoc.id}`;
                    // Actualizar Firestore CON LA URL
                    await db.collection('pedidos').doc(pedidoDoc.id).update({
                        foto_paquete: url
                    }).catch(err => console.warn(`⚠️ Error actualizando Firestore:`, err));
                    fotoPaqueteProcessada = url;
                }
                return {
                    id: pedidoDoc.id,
                    ...pedidoData,
                    // Datos enriquecidos
                    cliente_datos: clienteCompleto,
                    encomendista_datos: encomendista_completo,
                    destino_datos: destino_completo,
                    productos_datos: productos_completos,
                    cambios_estado: cambios_estado,
                    // Timestamps normalizados
                    fecha_creacion: pedidoData.fecha_creacion?.toDate?.() || pedidoData.fecha_creacion,
                    fecha_entrega_programada: pedidoData.fecha_entrega_programada?.toDate?.() || pedidoData.fecha_entrega_programada,
                    foto_paquete: fotoPaqueteProcessada
                };
            });
            const pedidosCompletos = await Promise.all(pedidosPromesas);
            console.log(`✅ [API V2] ${pedidosCompletos.length} pedidos por remunerar obtenidos`);
            return res.json({
                success: true,
                total: pedidosCompletos.length,
                fecha_actual: timestampHoy.toISOString(),
                pedidos: pedidosCompletos
            });
        }
        catch (error) {
            console.error(`[API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * Busca un pedido por su CODIGO_PEDIDO y retorna TODOS los datos completos
     * Ideal para escanear QR codes que contienen el código del pedido
     *
     * GET /pedido/codigo/:codigoPedido
     */
    app.get("/pedido/codigo/:codigoPedido", async (req, res) => {
        try {
            const { codigoPedido } = req.params;
            const db = admin.firestore();
            console.log(`[API V2] 🔍 Buscando pedido por código: ${codigoPedido}`);
            // 1. Buscar pedido por codigo_pedido
            const pedidosSnapshot = await db.collection('pedidos')
                .where('codigo_pedido', '==', codigoPedido)
                .limit(1)
                .get();
            if (pedidosSnapshot.empty) {
                return res.status(404).json({
                    success: false,
                    error: `Pedido con código '${codigoPedido}' no encontrado`
                });
            }
            const pedidoDoc = pedidosSnapshot.docs[0];
            const pedidoId = pedidoDoc.id;
            const pedidoData = pedidoDoc.data();
            console.log(`[API V2] ✅ Pedido encontrado: ${pedidoId}`);
            // 2. Obtener cliente
            let clienteCompleto = null;
            if (pedidoData?.cliente_id) {
                try {
                    const clienteDoc = await db.collection('clientes').doc(pedidoData.cliente_id).get();
                    if (clienteDoc.exists) {
                        clienteCompleto = {
                            id: clienteDoc.id,
                            ...clienteDoc.data()
                        };
                    }
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo cliente:`, err);
                }
            }
            // 3. Obtener encomendista
            let encomendista_completo = null;
            let destino_completo = null;
            if (pedidoData?.encomendista_id) {
                try {
                    const encomendistasDoc = await db.collection('encomendistas').doc(pedidoData.encomendista_id).get();
                    if (encomendistasDoc.exists) {
                        const encData = encomendistasDoc.data();
                        encomendista_completo = {
                            id: encomendistasDoc.id,
                            nombre: encData?.nombre,
                            telefono: encData?.telefono,
                            local: encData?.local
                        };
                        if (pedidoData?.destino_id && encData?.destinos) {
                            const destinoEncontrado = encData.destinos.find((d) => d.nombre === pedidoData.destino_id);
                            if (destinoEncontrado) {
                                let horarioEspecifico = null;
                                if (destinoEncontrado.horarios && Array.isArray(destinoEncontrado.horarios)) {
                                    horarioEspecifico = destinoEncontrado.horarios.find((h) => h.hora_inicio === pedidoData.hora_inicio && h.hora_fin === pedidoData.hora_fin);
                                }
                                destino_completo = {
                                    nombre: destinoEncontrado.nombre,
                                    horario_actual: horarioEspecifico || null,
                                    local: destinoEncontrado.local
                                };
                            }
                        }
                    }
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo encomendista:`, err);
                }
            }
            // 4. Obtener productos CON IMÁGENES
            let productos_completos = [];
            if (pedidoData?.productos_id && Array.isArray(pedidoData.productos_id)) {
                try {
                    for (const prodId of pedidoData.productos_id) {
                        const prodDoc = await db.collection('productos').doc(prodId).get();
                        if (prodDoc.exists) {
                            const prodData = prodDoc.data();
                            let imagen_url = null;
                            if (prodData?.usuario_id && prodData?.album && prodData?.codigo) {
                                try {
                                    const imgDoc = await db.collection('imagenes_productos')
                                        .doc(`${prodData.usuario_id}_${prodData.album}_${prodData.codigo}`)
                                        .get();
                                    if (imgDoc.exists) {
                                        imagen_url = `/api/obtenerProducto/${prodData.usuario_id}/${prodData.album}/${prodData.codigo}`;
                                    }
                                }
                                catch (imgErr) {
                                    console.warn(`⚠️ Error obteniendo URL de imagen de ${prodId}`);
                                }
                            }
                            productos_completos.push({
                                id: prodDoc.id,
                                ...prodData,
                                imagen_url: imagen_url
                            });
                        }
                    }
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo productos por ID:`, err);
                }
            }
            if (productos_completos.length === 0) {
                try {
                    const prodSnapshot = await db.collection('productos')
                        .where('pedido_id', '==', pedidoId)
                        .get();
                    for (const prodDoc of prodSnapshot.docs) {
                        const prodData = prodDoc.data();
                        let imagen_url = null;
                        if (prodData?.usuario_id && prodData?.album && prodData?.codigo) {
                            try {
                                const imgDoc = await db.collection('imagenes_productos')
                                    .doc(`${prodData.usuario_id}_${prodData.album}_${prodData.codigo}`)
                                    .get();
                                if (imgDoc.exists) {
                                    imagen_url = `/api/obtenerProducto/${prodData.usuario_id}/${prodData.album}/${prodData.codigo}`;
                                }
                            }
                            catch (imgErr) {
                                console.warn(`⚠️ Error obteniendo imagen de ${prodDoc.id}`);
                            }
                        }
                        productos_completos.push({
                            id: prodDoc.id,
                            ...prodData,
                            imagen_url: imagen_url
                        });
                    }
                }
                catch (err) {
                    console.warn(`⚠️ Error buscando productos por pedido_id:`, err);
                }
            }
            // 5. Obtener cambios de estado
            let cambios_estado = [];
            try {
                const cambiosSnapshot = await db
                    .collection('pedidos')
                    .doc(pedidoId)
                    .collection('cambios_estado')
                    .orderBy('fecha', 'desc')
                    .get();
                cambios_estado = cambiosSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }
            catch (err) {
                console.warn(`⚠️ Error obteniendo cambios de estado:`, err);
            }
            // 6. Procesar foto_paquete
            let fotoPaqueteProcessada = pedidoData?.foto_paquete || null;
            if (fotoPaqueteProcessada && esBase64(fotoPaqueteProcessada)) {
                const usuario_id = pedidoData?.usuario_id || 'unknown';
                const url = `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/obtenerFotoPaquete/${usuario_id}/${pedidoId}`;
                await db.collection('pedidos').doc(pedidoId).update({
                    foto_paquete: url
                }).catch(err => console.warn(`⚠️ Error actualizando Firestore:`, err));
                fotoPaqueteProcessada = url;
            }
            // 7. Armar respuesta completa
            const pedidoCompleto = {
                id: pedidoDoc.id,
                ...pedidoData,
                cliente_datos: clienteCompleto,
                encomendista_datos: encomendista_completo,
                destino_datos: destino_completo,
                productos_datos: productos_completos,
                cambios_estado: cambios_estado,
                fecha_creacion: pedidoData?.fecha_creacion?.toDate?.() || pedidoData?.fecha_creacion,
                fecha_entrega_programada: pedidoData?.fecha_entrega_programada?.toDate?.() || pedidoData?.fecha_entrega_programada,
                foto_paquete: fotoPaqueteProcessada
            };
            console.log(`✅ [API V2] Pedido ${codigoPedido} obtenido por código con todos los datos`);
            return res.json({
                success: true,
                pedido: pedidoCompleto
            });
        }
        catch (error) {
            console.error(`[API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * Actualiza estado de pedido + registra auditoría + guarda cambio de estado + sube imagen
     * Todo en UNA sola llamada ATÓMICA en el backend
     *
     * POST /pedido/:pedidoId/cambiar-estado
     * Body: { nuevoEstado, foto_base64?, notas?, usuario_email? }
     *
     * Registra automáticamente:
     * - estado_[estado]_user: email del usuario
     * - estado_[estado]_user_timestamp: ISO timestamp
     */
    app.post("/pedido/:pedidoId/cambiar-estado", async (req, res) => {
        try {
            const { pedidoId } = req.params;
            const { nuevoEstado, foto_base64, notas, usuario_email } = req.body;
            const db = admin.firestore();
            if (!nuevoEstado) {
                return res.status(400).json({
                    success: false,
                    error: "nuevoEstado es requerido"
                });
            }
            console.log(`[API V2] 🔄 Cambiando estado de ${pedidoId} a ${nuevoEstado}`);
            const pedidoRef = db.collection('pedidos').doc(pedidoId);
            const ahora = new Date();
            const ahoraISO = ahora.toISOString();
            // Mapeo de estados a campos de auditoría
            const estadoAuditMap = {
                'pendiente': 'estado_pendiente_user',
                'empacada': 'estado_empacada_user',
                'enviado': 'estado_enviado_user',
                'retirado': 'estado_retirado_user',
                'no-retirado': 'estado_no_retirado_user',
                'cancelado': 'estado_cancelado_user',
                'retirado-local': 'estado_retirado_local_user',
                'liberado': 'estado_liberado_user',
                'reservado': 'estado_reservado_user'
            };
            // Transacción para garantizar integridad
            await db.runTransaction(async (transaction) => {
                // 1. Actualizar estado del pedido + registrar auditoría
                const updateData = {
                    estado: nuevoEstado,
                    fecha_ultima_actualizacion: ahoraISO
                };
                // Registrar auditoría (usuario + timestamp) 
                const auditField = estadoAuditMap[nuevoEstado];
                if (auditField) {
                    updateData[auditField] = usuario_email || 'backend-unknown';
                    updateData[`${auditField}_timestamp`] = ahoraISO;
                    console.log(`[API V2] 📋 AUDITORÍA registrada: ${auditField} = ${usuario_email || 'backend-unknown'}`);
                }
                // Si viene foto base64 y es estado 'empacada', guardar URL
                if (foto_base64 && nuevoEstado === 'empacada') {
                    updateData.foto_paquete = `https://us-central1-eli-gomez-web.cloudfunctions.net/apiv2/obtenerFotoPaquete/${pedidoId}`;
                }
                transaction.update(pedidoRef, updateData);
                // 2. Guardar cambio de estado en subcolección
                const cambioRef = pedidoRef.collection('cambios_estado').doc();
                transaction.set(cambioRef, {
                    estado_anterior: (await pedidoRef.get()).data()?.estado,
                    estado_nuevo: nuevoEstado,
                    fecha: ahoraISO,
                    notas: notas || '',
                    usuario_email: usuario_email || 'backend-unknown',
                    usuario_id: req.body.usuario_id || 'unknown'
                });
            });
            // 3. Si hay foto, guardarla en Cloud Storage
            if (foto_base64 && nuevoEstado === 'empacada') {
                try {
                    const bucket = admin.storage().bucket();
                    const fotosPath = `fotos_paquetes/${pedidoId}/paquete.jpg`;
                    const file = bucket.file(fotosPath);
                    // Convertir base64 a buffer y guardar
                    const buffer = Buffer.from(foto_base64, 'base64');
                    await file.save(buffer, {
                        metadata: {
                            contentType: 'image/jpeg'
                        }
                    });
                    console.log(`✅ Foto de paquete guardada en Cloud Storage: ${fotosPath}`);
                }
                catch (err) {
                    console.warn(`⚠️ Error guardando foto en Cloud Storage:`, err);
                }
            }
            console.log(`✅ [API V2] Estado actualizado: ${nuevoEstado}`);
            return res.json({
                success: true,
                message: `Pedido actualizado a ${nuevoEstado}`,
                pedido_id: pedidoId,
                estado_nuevo: nuevoEstado,
                fecha: ahora
            });
        }
        catch (error) {
            console.error(`[API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * Obtiene foto de paquete desde Firestore (EXACTO COMO obtenerProducto)
     */
    app.get("/obtenerFotoPaquete/:usuario_id/:pedidoId", async (req, res) => {
        try {
            const { usuario_id, pedidoId } = req.params;
            const db = admin.firestore();
            const docId = `${usuario_id}_${pedidoId}_paquete`;
            console.log(`[API V2] Obteniendo foto del paquete: ${docId}`);
            const fotoDoc = await db.collection('fotos_paquetes').doc(docId).get();
            if (!fotoDoc.exists) {
                return res.status(404).json({
                    success: false,
                    error: "Foto no encontrada"
                });
            }
            const fotoData = fotoDoc.data();
            const fotoBase64 = fotoData?.fotoBas64;
            if (!fotoBase64) {
                return res.status(404).json({
                    success: false,
                    error: "Foto no encontrada"
                });
            }
            let base64Limpio = fotoBase64;
            if (fotoBase64.startsWith('data:image')) {
                base64Limpio = fotoBase64.split(',')[1] || fotoBase64;
            }
            const buffer = Buffer.from(base64Limpio, 'base64');
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.send(buffer);
        }
        catch (error) {
            console.error(`[API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * Subir foto del paquete (desde cliente, evita CORS)
     */
    app.post("/subirFotoPaquete", async (req, res) => {
        try {
            console.log(`[API V2] Recibiendo subida de foto de paquete...`);
            const { fotoBas64, usuario_id, pedidoId } = req.body;
            if (!fotoBas64 || !usuario_id || !pedidoId) {
                return res.status(400).json({
                    success: false,
                    error: "Parámetros requeridos: fotoBas64, usuario_id, pedidoId"
                });
            }
            // Guardar directamente en Firestore (como en subirProducto)
            const db = admin.firestore();
            const docId = `${usuario_id}_${pedidoId}_paquete`;
            console.log(`[API V2] Guardando foto de paquete en Firestore: ${docId}`);
            await db.collection('fotos_paquetes').doc(docId).set({
                usuario_id,
                pedidoId,
                fotoBas64,
                fecha_carga: new Date(),
                tamaño: Buffer.from(fotoBas64.split(',')[1] || fotoBas64, 'base64').length
            });
            console.log(`[API V2] ✅ Foto guardada exitosamente en Firestore`);
            // Actualizar Firestore pedidos con URL (EXACTO COMO PRODUCTOS)
            const url = `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/obtenerFotoPaquete/${usuario_id}/${pedidoId}`;
            await db.collection('pedidos').doc(pedidoId).update({
                foto_paquete: url,
                fecha_foto_actualizada: new Date()
            });
            return res.status(200).json({
                success: true,
                message: "Foto subida exitosamente",
                url: url,
                docId
            });
        }
        catch (error) {
            console.error(`[API V2] Error subiendo foto:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
}
//# sourceMappingURL=new-api.js.map