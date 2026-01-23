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
 * FUNCIONES HELPER PARA TRABAJAR SOLO CON STRINGS DE FECHA (SIN TIMEZONE ISSUES)
 */
function julianDayFromFecha(fechaStr) {
    if (!fechaStr || !/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
        return 0;
    }
    const [año, mes, día] = fechaStr.split('-').map(Number);
    const a = Math.floor((14 - mes) / 12);
    const y = año + 4800 - a;
    const m = mes + 12 * a - 3;
    return día + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}
function fechaDesdeJulianDay(jd) {
    const a = jd + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor((146097 * b) / 4);
    const d = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor((1461 * d) / 4);
    const m = Math.floor((5 * e + 2) / 153);
    const día = e - Math.floor((153 * m + 2) / 5) + 1;
    const mes = m + 3 - 12 * Math.floor(m / 10);
    const año = b * 100 + d - 4800 + Math.floor(m / 10);
    return `${año}-${String(mes).padStart(2, '0')}-${String(día).padStart(2, '0')}`;
}
function julianDayFromSeconds(seconds) {
    return Math.floor(seconds / 86400) + 2440588;
}
function sumarDias(fechaStr, dias) {
    const base = julianDayFromFecha(fechaStr);
    if (!base) {
        return fechaStr;
    }
    return fechaDesdeJulianDay(base + dias);
}
function obtenerDiaSemanaDesdeFecha(fechaStr) {
    const base = julianDayFromFecha(fechaStr);
    if (!base) {
        return 0;
    }
    return (base + 1) % 7; // 0=DOM, 1=LUN, ...
}
function convertirTimestampAFechaString(timestamp) {
    const DEBUG = true; // Activar logging detallado
    const UTC_OFFSET_HOURS = -6; // UTC-6 para Costa Rica
    if (!timestamp) {
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] Entrada null/undefined`);
        return 'N/A';
    }
    if (DEBUG)
        console.log(`[TIMESTAMP_DEBUG] ========================================`);
    if (DEBUG)
        console.log(`[TIMESTAMP_DEBUG] ENTRADA: tipo=${typeof timestamp}`);
    if (DEBUG)
        console.log(`[TIMESTAMP_DEBUG] valor completo=${JSON.stringify(timestamp)}`);
    if (DEBUG)
        console.log(`[TIMESTAMP_DEBUG] toString()="${String(timestamp)}"`);
    // Si es una string en formato YYYY-MM-DD, devolverla como está
    if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] ✅ DETECTADO: String YYYY-MM-DD -> "${timestamp}"`);
        return timestamp;
    }
    // Si es string ISO (YYYY-MM-DDTHH:mm:ss.SSSZ), extraer la fecha
    if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(timestamp)) {
        const resultado = timestamp.slice(0, 10);
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] ✅ DETECTADO: String ISO -> extraer fecha="${resultado}"`);
        return resultado;
    }
    // Si es una string, intentar parsear como fecha española
    if (typeof timestamp === 'string') {
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] 🔍 Intentando parsear como fecha española...`);
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] String recibido: "${timestamp}"`);
        const human = parseFechaHumana(timestamp);
        if (human) {
            if (DEBUG)
                console.log(`[TIMESTAMP_DEBUG] ✅ CONVERTIDO por parseFechaHumana() -> "${human}"`);
            return human;
        }
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] ❌ parseFechaHumana() devolvió null`);
    }
    // Verificar si es objeto Firestore timestamp
    if (DEBUG) {
        console.log(`[TIMESTAMP_DEBUG] Verificando propiedades de objeto:`);
        console.log(`[TIMESTAMP_DEBUG]   - timestamp.seconds = ${timestamp?.seconds}`);
        console.log(`[TIMESTAMP_DEBUG]   - timestamp._seconds = ${timestamp?._seconds}`);
        console.log(`[TIMESTAMP_DEBUG]   - timestamp.nanoseconds = ${timestamp?.nanoseconds}`);
        console.log(`[TIMESTAMP_DEBUG]   - timestamp._nanoseconds = ${timestamp?._nanoseconds}`);
        console.log(`[TIMESTAMP_DEBUG]   - timestamp.toDate() = ${typeof timestamp?.toDate}`);
        console.log(`[TIMESTAMP_DEBUG]   - timestamp.toMillis() = ${typeof timestamp?.toMillis}`);
    }
    let segundos = null;
    if (typeof timestamp === 'number') {
        segundos = Math.floor(timestamp);
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] 📊 Detectado número (Unix seconds): ${segundos}`);
    }
    else if (typeof timestamp?.seconds === 'number') {
        segundos = Math.floor(timestamp.seconds);
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] 📊 Detectado .seconds: ${segundos}`);
    }
    else if (typeof timestamp?._seconds === 'number') {
        segundos = Math.floor(timestamp._seconds);
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] 📊 Detectado ._seconds: ${segundos}`);
    }
    else if (typeof timestamp?.toMillis === 'function') {
        const millis = timestamp.toMillis();
        segundos = Math.floor(millis / 1000);
        if (DEBUG)
            console.log(`[TIMESTAMP_DEBUG] 📊 Detectado .toMillis(): millis=${millis} -> seconds=${segundos}`);
    }
    if (segundos !== null) {
        // Convertir segundos a fecha UTC
        const dateUTC = new Date(segundos * 1000);
        // Ajustar a zona horaria local (UTC-6)
        const offsetMs = UTC_OFFSET_HOURS * 60 * 60 * 1000;
        const dateLocal = new Date(dateUTC.getTime() + offsetMs);
        // Extraer año, mes, día en zona horaria local
        const year = dateLocal.getUTCFullYear();
        const month = String(dateLocal.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateLocal.getUTCDate()).padStart(2, '0');
        const resultado = `${year}-${month}-${day}`;
        if (DEBUG) {
            const isoUTC = dateUTC.toISOString();
            const localStr = dateUTC.toString();
            console.log(`[TIMESTAMP_DEBUG] ✅ CONVERTIDO desde segundos: ${segundos}`);
            console.log(`[TIMESTAMP_DEBUG]    ISO completo (UTC) = "${isoUTC}"`);
            console.log(`[TIMESTAMP_DEBUG]    Zona horaria LOCAL (UTC${UTC_OFFSET_HOURS}) = "${resultado}"`);
            console.log(`[TIMESTAMP_DEBUG]    NOTA: Se usa zona horaria UTC${UTC_OFFSET_HOURS}`);
        }
        return resultado;
    }
    if (typeof timestamp?.toDate === 'function') {
        try {
            const dateUTC = timestamp.toDate();
            const isoFromToDate = dateUTC.toISOString();
            // Ajustar a zona horaria local (UTC-6)
            const offsetMs = UTC_OFFSET_HOURS * 60 * 60 * 1000;
            const dateLocal = new Date(dateUTC.getTime() + offsetMs);
            // Extraer año, mes, día en zona horaria local
            const year = dateLocal.getUTCFullYear();
            const month = String(dateLocal.getUTCMonth() + 1).padStart(2, '0');
            const day = String(dateLocal.getUTCDate()).padStart(2, '0');
            const resultado = `${year}-${month}-${day}`;
            if (DEBUG)
                console.log(`[TIMESTAMP_DEBUG] ✅ CONVERTIDO desde .toDate(): "${isoFromToDate}" -> "${resultado}" (UTC${UTC_OFFSET_HOURS})`);
            return resultado;
        }
        catch (err) {
            if (DEBUG)
                console.log(`[TIMESTAMP_DEBUG] ❌ ERROR en .toDate(): ${err}`);
        }
    }
    if (DEBUG)
        console.log(`[TIMESTAMP_DEBUG] ❌ NO SE PUDO CONVERTIR: tipo=${typeof timestamp}, valor="${String(timestamp).substring(0, 100)}"`);
    console.warn(`[convertirTimestamp] No se pudo convertir: tipo=${typeof timestamp}, valor="${String(timestamp).substring(0, 80)}"`);
    return 'N/A';
}
function parseFechaHumana(text) {
    if (!text || typeof text !== 'string') {
        console.log(`[PARSE_HUMANA_DEBUG] Entrada null/undefined`);
        return null;
    }
    console.log(`[PARSE_HUMANA_DEBUG] ========================================`);
    console.log(`[PARSE_HUMANA_DEBUG] Entrada: "${text}"`);
    const mesesMap = {
        enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
        julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
    };
    // Extraer "DD de MES de AAAA" ignorando todo lo que venga después
    const match = text.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
    if (!match) {
        console.log(`[PARSE_HUMANA_DEBUG] ❌ REGEX NO COINCIDIÓ`);
        console.log(`[PARSE_HUMANA_DEBUG]   Intentando coincidir con: /(\\d{1,2})\\s+de\\s+([a-záéíóú]+)\\s+de\\s+(\\d{4})/i`);
        console.log(`[PARSE_HUMANA_DEBUG]   Contra: "${text.toLowerCase()}"`);
        return null;
    }
    console.log(`[PARSE_HUMANA_DEBUG] ✅ REGEX coincidió:`);
    console.log(`[PARSE_HUMANA_DEBUG]   match[1] (día) = "${match[1]}"`);
    console.log(`[PARSE_HUMANA_DEBUG]   match[2] (mes) = "${match[2]}"`);
    console.log(`[PARSE_HUMANA_DEBUG]   match[3] (año) = "${match[3]}"`);
    const dia = match[1].padStart(2, '0');
    const mesNombre = match[2].toLowerCase().trim();
    const año = match[3];
    console.log(`[PARSE_HUMANA_DEBUG] Después de procesar:`);
    console.log(`[PARSE_HUMANA_DEBUG]   dia = "${dia}"`);
    console.log(`[PARSE_HUMANA_DEBUG]   mesNombre = "${mesNombre}"`);
    console.log(`[PARSE_HUMANA_DEBUG]   año = "${año}"`);
    const mesNumero = mesesMap[mesNombre];
    if (!mesNumero) {
        console.log(`[PARSE_HUMANA_DEBUG] ❌ Mes desconocido: "${mesNombre}"`);
        console.log(`[PARSE_HUMANA_DEBUG]   Meses válidos: ${Object.keys(mesesMap).join(', ')}`);
        return null;
    }
    console.log(`[PARSE_HUMANA_DEBUG] Mes encontrado: "${mesNombre}" -> "${mesNumero}"`);
    const resultado = `${año}-${mesNumero}-${dia}`;
    console.log(`[PARSE_HUMANA_DEBUG] ✅ RESULTADO FINAL: "${resultado}"`);
    return resultado;
}
function obtenerFechaHoyServidorStr() {
    const ahora = new Date();
    return ahora.toISOString().slice(0, 10);
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
                fecha_creacion: convertirTimestampAFechaString(pedidoData?.fecha_creacion),
                fecha_entrega_programada: convertirTimestampAFechaString(pedidoData?.fecha_entrega_programada),
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
                    fecha_creacion: convertirTimestampAFechaString(pedidoData.fecha_creacion),
                    fecha_entrega_programada: convertirTimestampAFechaString(pedidoData.fecha_entrega_programada),
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
     * Lógica EXACTA a la web:
     * - Excluye estados: liberado, retirado-local, cancelado, pendiente, empacada, remunero
     * - Incluye implícitamente: enviado, retirado, no-retirado
     * - Solo pedidos donde fecha_entrega_programada <= hoy (sin horas/minutos/segundos)
     *
     * GET /pedidos-por-remunerar
     * Con toda la data: cliente, encomendista, destino, productos, cambios_estado, foto
     */
    app.get("/pedidos-por-remunerar", async (req, res) => {
        try {
            const db = admin.firestore();
            const fechaHoyParam = req.query.fecha_hoy;
            let hoyStr;
            if (fechaHoyParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaHoyParam)) {
                hoyStr = fechaHoyParam;
                console.log(`[API V2] Usando fecha_hoy recibida del cliente: ${hoyStr}`);
            }
            else {
                hoyStr = obtenerFechaHoyServidorStr();
                console.log(`[API V2] Usando fecha_hoy del servidor: ${hoyStr}`);
            }
            // Estados que EXCLUIMOS (NO pueden estar en remunerar)
            const estadosExcluidos = ['liberado', 'retirado-local', 'cancelado', 'pendiente', 'empacada', 'remunero'];
            // Estados que INCLUIMOS (solo estos pueden remunerarse)
            const estadosIncluidos = ['enviado', 'retirado', 'no-retirado'];
            // Query: obtener todos con estados incluidos (sin orderBy)
            const db_query = db.collection('pedidos')
                .where('estado', 'in', estadosIncluidos);
            const snapshot = await db_query.get();
            const filteredDocs = snapshot.docs.filter(doc => {
                const pedidoData = doc.data();
                const fechaEntregaStr = convertirTimestampAFechaString(pedidoData.fecha_entrega_programada);
                if (!fechaEntregaStr || fechaEntregaStr === 'N/A') {
                    return false;
                }
                console.log(`[Filtro fecha] fechaEntregaStr: ${fechaEntregaStr} | hoyStr: ${hoyStr} | incluir: ${fechaEntregaStr < hoyStr}`);
                return fechaEntregaStr < hoyStr;
            });
            const sortedDocs = filteredDocs.sort((a, b) => {
                const fechaA = convertirTimestampAFechaString(a.data().fecha_entrega_programada);
                const fechaB = convertirTimestampAFechaString(b.data().fecha_entrega_programada);
                return fechaA.localeCompare(fechaB);
            }).slice(0, 1000);
            // Enriquecer cada pedido en paralelo
            const pedidosPromesas = filteredDocs.map(async (pedidoDoc) => {
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
                    fecha_creacion: convertirTimestampAFechaString(pedidoData.fecha_creacion),
                    fecha_entrega_programada: convertirTimestampAFechaString(pedidoData.fecha_entrega_programada),
                    foto_paquete: fotoPaqueteProcessada
                };
            });
            const pedidosCompletos = await Promise.all(pedidosPromesas);
            console.log(`✅ [API V2] ${pedidosCompletos.length} pedidos por remunerar obtenidos`);
            return res.json({
                success: true,
                total: pedidosCompletos.length,
                fecha_actual: hoyStr,
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
     * ENDPOINT OPTIMIZADO PARA MÓVIL: Obtiene pedidos URGENTES de empacar
     *
     * Lógica (USANDO SOLO STRINGS DE FECHA):
     * 1. Encuentra el ÚLTIMO día de envío (Mié o Sáb anterior)
     * 2. Suma 7 días a ese día
     * 3. Retorna pedidos PENDIENTES con fecha < fecha_límite
     *
     * ✅ Trabaja SOLO con strings YYYY-MM-DD, SIN objetos Date que cambien timezone
     *
     * GET /pedidos-urgentes-empacar?fecha_hoy=2026-01-19
     */
    app.get("/pedidos-urgentes-empacar", async (req, res) => {
        try {
            const db = admin.firestore();
            console.log(`\n🚀 [API V2] Obteniendo PEDIDOS URGENTES DE EMPACAR`);
            // 1. Obtener fecha de HOY (SOLO COMO STRING)
            const fechaHoyParam = req.query.fecha_hoy;
            let hoyStr;
            if (fechaHoyParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaHoyParam)) {
                hoyStr = fechaHoyParam;
                console.log(`[API V2] Usando fecha_hoy recibida del cliente: ${hoyStr}`);
            }
            else {
                hoyStr = obtenerFechaHoyServidorStr();
                console.log(`[API V2] Usando fecha_hoy del servidor: ${hoyStr}`);
            }
            // 2. Obtener día de la semana
            const diaHoy = obtenerDiaSemanaDesdeFecha(hoyStr);
            const diasSemana = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SAB'];
            console.log(`📅 HOY: ${hoyStr} (${diasSemana[diaHoy]})`);
            // 3. Encontrar el ÚLTIMO día de envío (Mié=3 o Sáb=6)
            let fechaDiaEnvioStr;
            if (diaHoy === 3 || diaHoy === 6) {
                fechaDiaEnvioStr = hoyStr;
                console.log(`  ➜ HOY es día de envío (${diaHoy === 3 ? 'MIÉ' : 'SAB'})`);
            }
            else {
                fechaDiaEnvioStr = hoyStr;
                let diasRetrocedidos = 0;
                while (true) {
                    fechaDiaEnvioStr = sumarDias(fechaDiaEnvioStr, -1);
                    diasRetrocedidos++;
                    const diaTemp = obtenerDiaSemanaDesdeFecha(fechaDiaEnvioStr);
                    if (diaTemp === 3 || diaTemp === 6) {
                        console.log(`  ➜ Último envío: ${diaTemp === 3 ? 'MIÉ' : 'SAB'} ${fechaDiaEnvioStr}`);
                        break;
                    }
                    if (diasRetrocedidos > 7)
                        break; // Protección infinito
                }
            }
            // 4. Sumar 7 días al día de envío encontrado
            const fechaLimiteStr = sumarDias(fechaDiaEnvioStr, 7);
            console.log(`⏰ Fecha límite: ${fechaLimiteStr}`);
            console.log(`📋 Buscando: PENDIENTE con fecha < ${fechaLimiteStr}\n`);
            // 5. Obtener TODOS los pedidos
            const pedidosSnapshot = await db.collection('pedidos').get();
            // 6. Filtrar los URGENTES (COMPARANDO SOLO STRINGS)
            const pedidosUrgentes = [];
            for (const doc of pedidosSnapshot.docs) {
                const data = doc.data();
                if (data.estado?.toLowerCase() !== 'pendiente')
                    continue;
                // ✅ CONVERTIR TIMESTAMP A STRING (SIN TIMEZONE ISSUES)
                const fechaEntregaStr = convertirTimestampAFechaString(data.fecha_entrega_programada);
                console.log(`  📦 Pedido ${doc.id}: fecha_entrega=${fechaEntregaStr}, estado=${data.estado}`);
                // ✅ COMPARAR STRINGS (funciona alfabéticamente con YYYY-MM-DD)
                if (fechaEntregaStr >= fechaLimiteStr) {
                    console.log(`    ➜ IGNORAR (${fechaEntregaStr} >= ${fechaLimiteStr})`);
                    continue;
                }
                console.log(`    ✅ INCLUIR (${fechaEntregaStr} < ${fechaLimiteStr})`);
                // Enriquecer con productos_datos
                let productos_completos = [];
                if (data.productos_id && Array.isArray(data.productos_id)) {
                    for (const prodId of data.productos_id) {
                        try {
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
                        catch (err) {
                            console.warn(`⚠️ Error obteniendo producto ${prodId}:`, err);
                        }
                    }
                }
                if (productos_completos.length === 0) {
                    try {
                        const prodSnapshot = await db.collection('productos')
                            .where('pedido_id', '==', doc.id)
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
                pedidosUrgentes.push({
                    ...data,
                    id: doc.id,
                    fecha_entrega_programada: fechaEntregaStr, // ✅ STRING YYYY-MM-DD, NO TIMESTAMP
                    fecha_creacion: convertirTimestampAFechaString(data.fecha_creacion),
                    productos_datos: productos_completos
                });
            }
            // Ordenar por fecha de entrega (comparando strings funciona bien)
            pedidosUrgentes.sort((a, b) => a.fecha_entrega_programada.localeCompare(b.fecha_entrega_programada));
            console.log(`\n✅ [API V2] ${pedidosUrgentes.length} pedidos urgentes encontrados\n`);
            return res.json({
                success: true,
                total: pedidosUrgentes.length,
                fecha_limite: fechaLimiteStr,
                fecha_actual: hoyStr,
                pedidos: pedidosUrgentes
            });
        }
        catch (error) {
            console.error(`❌ [API V2] Error:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * ENDPOINT OPTIMIZADO PARA MÓVIL: Obtiene pedidos PARA ENVÍOS (HOY o próximo envío)
     *
     * Lógica (USANDO SOLO STRINGS DE FECHA):
     * 1. Si HOY es MIÉ o SAB → son los envíos de HOY (rango: HOY hasta HOY+2)
     * 2. Si HOY es otro día → son los envíos del PRÓXIMO MIÉ o SAB (rango: próximo hasta próximo+2)
     * 3. Retorna PENDIENTE + EMPACADA en el rango
     *
     * ✅ Trabaja SOLO con strings YYYY-MM-DD, SIN objetos Date
     *
     * GET /pedidos-para-envios?fecha_hoy=2026-01-19
     */
    app.get("/pedidos-para-envios", async (req, res) => {
        try {
            const db = admin.firestore();
            console.log(`\n🚀 [API V2] Obteniendo PEDIDOS PARA ENVÍOS`);
            // 1. Obtener fecha de HOY (SOLO COMO STRING)
            const fechaHoyParam = req.query.fecha_hoy;
            let hoyStr;
            if (fechaHoyParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaHoyParam)) {
                hoyStr = fechaHoyParam;
                console.log(`[API V2] Usando fecha_hoy recibida del cliente: ${hoyStr}`);
            }
            else {
                hoyStr = obtenerFechaHoyServidorStr();
                console.log(`[API V2] Usando fecha_hoy del servidor: ${hoyStr}`);
            }
            const diaHoy = obtenerDiaSemanaDesdeFecha(hoyStr);
            const diasSemana = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SAB'];
            console.log(`📅 HOY: ${hoyStr} (${diasSemana[diaHoy]})`);
            // 2. Calcular rango de fechas
            let fechaInicioStr;
            let fechaFinStr;
            let diaEnvio = '';
            if (diaHoy === 3 || diaHoy === 6) {
                fechaInicioStr = hoyStr;
                fechaFinStr = sumarDias(hoyStr, 2);
                diaEnvio = diaHoy === 3 ? 'MIÉRCOLES' : 'SÁBADO';
                console.log(`  ➜ HOY es día de envío: ${diaEnvio}`);
            }
            else {
                let proximoEnvioStr = hoyStr;
                let diasAvanzados = 0;
                while (true) {
                    proximoEnvioStr = sumarDias(proximoEnvioStr, 1);
                    diasAvanzados++;
                    const dia = obtenerDiaSemanaDesdeFecha(proximoEnvioStr);
                    if (dia === 3 || dia === 6) {
                        diaEnvio = dia === 3 ? 'MIÉRCOLES' : 'SÁBADO';
                        console.log(`  ➜ Próximo envío: ${diaEnvio} ${proximoEnvioStr}`);
                        break;
                    }
                    if (diasAvanzados > 7)
                        break;
                }
                fechaInicioStr = proximoEnvioStr;
                fechaFinStr = sumarDias(proximoEnvioStr, 2);
            }
            console.log(`📋 Rango: ${fechaInicioStr} → ${fechaFinStr}`);
            console.log(`🔍 Buscando: PENDIENTE + EMPACADA en ese rango\n`);
            // 3. Obtener TODOS los pedidos
            const pedidosSnapshot = await db.collection('pedidos').get();
            // 4. Filtrar por rango de fechas (COMPARANDO SOLO STRINGS)
            let pedidosParaEnvios = [];
            for (const doc of pedidosSnapshot.docs) {
                const data = doc.data();
                const estado = data.estado?.toLowerCase();
                if (estado !== 'pendiente' && estado !== 'empacada')
                    continue;
                // ✅ CONVERTIR TIMESTAMP A STRING (SIN TIMEZONE ISSUES)
                const fechaEntregaStr = convertirTimestampAFechaString(data.fecha_entrega_programada);
                // ✅ COMPARAR STRINGS (funciona alfabéticamente con YYYY-MM-DD)
                if (fechaEntregaStr < fechaInicioStr || fechaEntregaStr > fechaFinStr) {
                    continue;
                }
                console.log(`  ✅ Pedido ${doc.id}: fecha=${fechaEntregaStr}, estado=${estado}`);
                pedidosParaEnvios.push({
                    _id: doc.id,
                    _data: data,
                    _fechaEntrega: fechaEntregaStr,
                    _fechaCreacion: convertirTimestampAFechaString(data.fecha_creacion)
                });
            }
            // Ordenar por fecha de entrega
            pedidosParaEnvios.sort((a, b) => a._fechaEntrega.localeCompare(b._fechaEntrega));
            // 5. Enriquecer cada pedido con productos_datos
            const pedidosProcesados = [];
            for (let pedidoTemp of pedidosParaEnvios) {
                const pedido = pedidoTemp._data;
                const pedidoId = pedidoTemp._id;
                let productos_completos = [];
                try {
                    if (pedido.productos_id && Array.isArray(pedido.productos_id)) {
                        for (const prodId of pedido.productos_id) {
                            try {
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
                            catch (err) {
                                console.warn(`⚠️ Error obteniendo producto ${prodId}:`, err);
                            }
                        }
                    }
                    if (productos_completos.length === 0) {
                        const prodSnapshot = await db.collection('productos')
                            .where('pedido_id', '==', pedido.id)
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
                }
                catch (err) {
                    console.warn(`⚠️ Error obteniendo productos para pedido ${pedido.id}:`, err);
                }
                // Procesar foto_paquete
                let fotoPaqueteProcessada = pedido.foto_paquete || null;
                if (fotoPaqueteProcessada && esBase64(fotoPaqueteProcessada)) {
                    try {
                        const usuario_id = pedido.usuario_id || 'unknown';
                        const url = `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/obtenerFotoPaquete/${usuario_id}/${pedidoId}`;
                        await db.collection('pedidos').doc(pedidoId).update({
                            foto_paquete: url
                        }).catch(err => console.warn(`⚠️ Error actualizando Firestore:`, err));
                        fotoPaqueteProcessada = url;
                    }
                    catch (err) {
                        console.warn(`⚠️ Error procesando foto_paquete del pedido ${pedidoId}:`, err);
                    }
                }
                pedidosProcesados.push({
                    ...pedido,
                    id: pedidoId,
                    fecha_entrega_programada: pedidoTemp._fechaEntrega, // ✅ STRING YYYY-MM-DD
                    fecha_creacion: pedidoTemp._fechaCreacion, // ✅ STRING YYYY-MM-DD
                    productos_datos: productos_completos,
                    foto_paquete: fotoPaqueteProcessada
                });
            }
            console.log(`\n✅ [API V2] ${pedidosProcesados.length} pedidos para envíos encontrados\n`);
            return res.json({
                success: true,
                total: pedidosProcesados.length,
                fecha_inicio: fechaInicioStr,
                fecha_fin: fechaFinStr,
                dia_envio: diaEnvio,
                fecha_actual: hoyStr,
                pedidos: pedidosProcesados
            });
        }
        catch (error) {
            console.error(`❌ [API V2] Error:`, error);
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
                fecha_creacion: convertirTimestampAFechaString(pedidoData?.fecha_creacion),
                fecha_entrega_programada: convertirTimestampAFechaString(pedidoData?.fecha_entrega_programada),
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
            // Variables para tracking de foto
            let fotoGuardada = false;
            let fotoUrl = '';
            const usuario_id = req.body.usuario_id || 'unknown';
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
                // Si viene foto base64, guardar en colección fotos_paquetes (NO en el pedido)
                if (foto_base64 && usuario_id) {
                    // Limpiar prefijo data: si existe
                    const base64Clean = foto_base64.replace(/^data:image\/[^;]+;base64,/, '');
                    // Generar URL para la foto
                    fotoUrl = `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/obtenerFotoPaquete/${usuario_id}/${pedidoId}`;
                    // Guardar solo la URL en el pedido (NO el base64)
                    updateData.foto_paquete = fotoUrl;
                    updateData.foto_paquete_timestamp = ahoraISO;
                    // Guardar base64 en colección separada fotos_paquetes
                    const fotoDocId = `${usuario_id}_${pedidoId}_paquete`;
                    const fotoRef = db.collection('fotos_paquetes').doc(fotoDocId);
                    transaction.set(fotoRef, {
                        usuario_id,
                        pedidoId,
                        fotoBas64: base64Clean,
                        fecha: ahoraISO,
                        tamaño: Buffer.from(base64Clean, 'base64').length
                    });
                    fotoGuardada = true;
                    console.log(`[API V2] 📸 Foto guardada en fotos_paquetes/${fotoDocId}`);
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
                    usuario_id: usuario_id
                });
            });
            // 3. Log de resultado
            if (fotoGuardada) {
                console.log(`✅ [API V2] Foto de paquete guardada correctamente`);
            }
            console.log(`✅ [API V2] Estado actualizado: ${nuevoEstado}`);
            return res.json({
                success: true,
                message: fotoGuardada ? `Pedido actualizado a ${nuevoEstado} con foto` : `Pedido actualizado a ${nuevoEstado}`,
                pedido_id: pedidoId,
                estado_nuevo: nuevoEstado,
                foto_guardada: fotoGuardada,
                foto_paquete_url: fotoUrl || null,
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
    /**
     * � ENDPOINT DE DIAGNÓSTICO
     * Muestra 10 pedidos con sus fechas en Firestore vs dia_entrega
     * Ayuda a entender los problemas de sincronización
     *
     * GET /diagnosticar-fechas
     */
    app.get("/diagnosticar-fechas", async (req, res) => {
        try {
            const db = admin.firestore();
            const snapshot = await db.collection('pedidos').limit(20).get();
            const diasNombreAIndice = {
                'domingo': 0, 'dom': 0,
                'lunes': 1, 'lun': 1,
                'martes': 2, 'mar': 2,
                'miércoles': 3, 'miercoles': 3, 'mié': 3,
                'jueves': 4, 'jue': 4,
                'viernes': 5, 'vie': 5,
                'sábado': 6, 'sabado': 6, 'sáb': 6
            };
            const diasIndiceANombre = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
            const diagnostico = [];
            let coincidentes = 0;
            let desalineados = 0;
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const fechaEnFirestore = data?.fecha_entrega_programada;
                const diaEntrega = data?.dia_entrega;
                if (fechaEnFirestore && typeof fechaEnFirestore === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaEnFirestore)) {
                    const diaActual = obtenerDiaSemanaDesdeFecha(fechaEnFirestore);
                    const diaTargetIndex = diasNombreAIndice[diaEntrega?.toLowerCase().trim()] ?? -1;
                    const coincide = diaActual === diaTargetIndex;
                    if (coincide)
                        coincidentes++;
                    else
                        desalineados++;
                    diagnostico.push({
                        codigo: data?.codigo_pedido,
                        dia_entrega_campo: diaEntrega,
                        fecha_en_firestore: fechaEnFirestore,
                        dia_real_de_fecha: diasIndiceANombre[diaActual],
                        dia_esperado: diaTargetIndex >= 0 ? diasIndiceANombre[diaTargetIndex] : 'INVÁLIDO',
                        coincide: coincide
                    });
                }
            }
            return res.json({
                total_revisados: snapshot.size,
                coincidentes,
                desalineados,
                diagnostico
            });
        }
        catch (error) {
            return res.status(500).json({ error: error.message });
        }
    });
    /**
     * �🔧 ENDPOINT DE CORRECCIÓN DE FECHAS
     * Ajusta fecha_entrega_programada basándose en el día_entrega
     *
     * Si día_entrega = "Martes" pero fecha es lunes, lo cambia a próximo martes
     * Resuelve problemas de timezone donde la fecha quedó 1 día antes/después
     *
     * POST /corregir-fechas-por-dia
     * Body: { confirmar: true }
     *
     * Retorna reporte de cuántos pedidos se corrigieron
     */
    app.post("/corregir-fechas-por-dia", async (req, res) => {
        try {
            const { confirmar } = req.body;
            if (!confirmar) {
                return res.status(400).json({
                    success: false,
                    error: "Debes enviar { confirmar: true } para ejecutar la corrección"
                });
            }
            console.log(`\n🔧 [CORRECCIÓN] AJUSTANDO FECHAS POR DÍA DE ENTREGA\n`);
            const db = admin.firestore();
            // Mapa de nombres de días a índice (0=DOM, 1=LUN, ..., 6=SAB)
            const diasNombreAIndice = {
                'domingo': 0, 'dom': 0,
                'lunes': 1, 'lun': 1,
                'martes': 2, 'mar': 2,
                'miércoles': 3, 'miercoles': 3, 'mié': 3,
                'jueves': 4, 'jue': 4,
                'viernes': 5, 'vie': 5,
                'sábado': 6, 'sabado': 6, 'sáb': 6
            };
            // Mapa inverso: índice a nombre
            const diasIndiceANombre = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
            /**
             * Dado un día de semana (índice 0-6) y una fecha aproximada,
             * devuelve la fecha que corresponde a ese día de semana
             * dentro de ±3 días de la fecha aproximada
             */
            function encontrarFechaDelDia(diaTargetIndex, fechaAproximada) {
                // Revisar -3, -2, -1, 0, +1, +2, +3 días
                for (let offset = -3; offset <= 3; offset++) {
                    const fechaPrueba = sumarDias(fechaAproximada, offset);
                    const diaActual = obtenerDiaSemanaDesdeFecha(fechaPrueba);
                    if (diaActual === diaTargetIndex) {
                        return fechaPrueba;
                    }
                }
                // Si no encuentra en rango ±3, devolver la aproximada
                return fechaAproximada;
            }
            // Obtener todos los pedidos
            const snapshot = await db.collection('pedidos').get();
            console.log(`📊 Total de pedidos en Firestore: ${snapshot.size}`);
            let corregidosCount = 0;
            let yaCorrectosCount = 0;
            let errorCount = 0;
            let saltadosCount = 0;
            const corregidosPedidos = [];
            const saltados = [];
            // Procesar cada pedido
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const codigoPedido = data?.codigo_pedido || 'DESCONOCIDO';
                const diaEntrega = data?.dia_entrega; // Ej: "Martes", "MARTES", "martes"
                const fechaActual = data?.fecha_entrega_programada; // Ej: "2026-01-19"
                // Validaciones
                if (!diaEntrega || !fechaActual) {
                    console.log(`⏭️  ${codigoPedido}: FALTA dia_entrega O fecha_entrega_programada`);
                    saltadosCount++;
                    saltados.push({
                        codigo: codigoPedido,
                        razon: 'Falta dia_entrega o fecha_entrega_programada'
                    });
                    continue;
                }
                if (typeof fechaActual !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaActual)) {
                    console.log(`⏭️  ${codigoPedido}: fecha_entrega_programada NO ES STRING YYYY-MM-DD (es: ${typeof fechaActual})`);
                    saltadosCount++;
                    saltados.push({
                        codigo: codigoPedido,
                        razon: `fecha_entrega_programada NO ES STRING YYYY-MM-DD (es: ${typeof fechaActual})`
                    });
                    continue;
                }
                // Normalizar nombre del día
                const diaEntregaNormalizado = diaEntrega.toLowerCase().trim();
                const diaTargetIndex = diasNombreAIndice[diaEntregaNormalizado];
                if (diaTargetIndex === undefined) {
                    console.log(`❌ ${codigoPedido}: dia_entrega INVÁLIDO → "${diaEntrega}"`);
                    saltadosCount++;
                    saltados.push({
                        codigo: codigoPedido,
                        razon: `dia_entrega INVÁLIDO: "${diaEntrega}"`
                    });
                    continue;
                }
                // Obtener día de semana de la fecha actual
                const diaActualIndex = obtenerDiaSemanaDesdeFecha(fechaActual);
                // Si ya coincide, no corregir
                if (diaActualIndex === diaTargetIndex) {
                    console.log(`✅ ${codigoPedido}: CORRECTO "${diaEntrega}" (${diasIndiceANombre[diaActualIndex]}) → "${fechaActual}"`);
                    yaCorrectosCount++;
                    continue;
                }
                // Buscar la fecha correcta para ese día
                const fechaCorregida = encontrarFechaDelDia(diaTargetIndex, fechaActual);
                console.log(`🔄 ${codigoPedido}: CORRIGIENDO "${diaEntrega}"`);
                console.log(`   Fecha anterior: "${fechaActual}" (${diasIndiceANombre[diaActualIndex]})`);
                console.log(`   Fecha nueva:    "${fechaCorregida}" (${diasIndiceANombre[diaTargetIndex]})`);
                // Actualizar en Firestore
                try {
                    await db.collection('pedidos').doc(doc.id).update({
                        fecha_entrega_programada: fechaCorregida
                    });
                    corregidosCount++;
                    corregidosPedidos.push({
                        codigo: codigoPedido,
                        id: doc.id,
                        dia_entrega: diaEntrega,
                        fecha_anterior: fechaActual,
                        fecha_nueva: fechaCorregida
                    });
                }
                catch (updateErr) {
                    console.log(`❌ ${codigoPedido}: ERROR AL ACTUALIZAR - ${updateErr.message}`);
                    errorCount++;
                }
            }
            console.log(`\n📈 RESULTADO FINAL DE CORRECCIÓN:`);
            console.log(`   🔄 Corregidos: ${corregidosCount}`);
            console.log(`   ✅ Ya correctos: ${yaCorrectosCount}`);
            console.log(`   ⏭️  Saltados: ${saltadosCount}`);
            console.log(`   ❌ Errores: ${errorCount}`);
            console.log(`   📊 Total procesado: ${snapshot.size}`);
            console.log(`   ✓ Suma verificada: ${corregidosCount + yaCorrectosCount + saltadosCount + errorCount} = ${snapshot.size}`);
            console.log(`\n✨ Corrección completada\n`);
            return res.json({
                success: true,
                message: "Corrección completada exitosamente",
                resultado: {
                    corregidos: corregidosCount,
                    yaCorrectos: yaCorrectosCount,
                    saltados: saltadosCount,
                    errores: errorCount,
                    total: snapshot.size,
                    pedidosCorregidos: corregidosPedidos,
                    pedidosSaltados: saltados
                }
            });
        }
        catch (error) {
            console.error(`[CORRECCIÓN] ERROR:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
    /**
     * ⚡ ENDPOINT DE MIGRACIÓN
     * Convierte TODOS los timestamps de fecha_entrega_programada a STRINGS (YYYY-MM-DD)
     * Zona horaria: UTC-6 (Costa Rica)
     *
     * POST /migrar-fechas-a-strings
     * Body: { confirmar: true }
     *
     * Retorna reporte de cuántos pedidos se migraron
     */
    app.post("/migrar-fechas-a-strings", async (req, res) => {
        try {
            const { confirmar } = req.body;
            if (!confirmar) {
                return res.status(400).json({
                    success: false,
                    error: "Debes enviar { confirmar: true } para ejecutar la migración"
                });
            }
            console.log(`\n🔄 [MIGRACIÓN] INICIANDO CONVERSIÓN DE TIMESTAMPS A STRINGS\n`);
            const db = admin.firestore();
            const UTC_OFFSET_HOURS = -6; // Costa Rica
            // Función auxiliar para convertir timestamp a string
            function convertirTimestampAStringLocal(timestamp) {
                if (!timestamp)
                    return null;
                let segundos = null;
                // Extraer segundos de diferentes formatos
                if (typeof timestamp === 'number') {
                    segundos = timestamp;
                }
                else if (typeof timestamp?.seconds === 'number') {
                    segundos = timestamp.seconds;
                }
                else if (typeof timestamp?._seconds === 'number') {
                    segundos = timestamp._seconds;
                }
                if (segundos === null)
                    return null;
                // Convertir a fecha UTC
                const dateUTC = new Date(segundos * 1000);
                // Ajustar por zona horaria local
                const offsetMs = UTC_OFFSET_HOURS * 60 * 60 * 1000;
                const dateLocal = new Date(dateUTC.getTime() + offsetMs);
                // Extraer año, mes, día
                const year = dateLocal.getUTCFullYear();
                const month = String(dateLocal.getUTCMonth() + 1).padStart(2, '0');
                const day = String(dateLocal.getUTCDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            // Obtener todos los pedidos
            const snapshot = await db.collection('pedidos').get();
            console.log(`📊 Total de pedidos en Firestore: ${snapshot.size}`);
            let migratedCount = 0;
            let alreadyStringCount = 0;
            let errorCount = 0;
            const migratedPedidos = [];
            // Procesar cada pedido
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const codigoPedido = data.codigo_pedido || 'DESCONOCIDO';
                const currentFecha = data.fecha_entrega_programada;
                // Si ya es string YYYY-MM-DD, omitir
                if (typeof currentFecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(currentFecha)) {
                    console.log(`⏭️  ${codigoPedido}: YA ES STRING → "${currentFecha}"`);
                    alreadyStringCount++;
                    continue;
                }
                // Convertir timestamp a string
                const newFecha = convertirTimestampAStringLocal(currentFecha);
                if (!newFecha) {
                    console.log(`❌ ${codigoPedido}: NO SE PUDO CONVERTIR - ${JSON.stringify(currentFecha).substring(0, 50)}`);
                    errorCount++;
                    continue;
                }
                // Actualizar en Firestore
                try {
                    await db.collection('pedidos').doc(doc.id).update({
                        fecha_entrega_programada: newFecha // 🔑 GUARDAR COMO STRING
                    });
                    console.log(`✅ ${codigoPedido}: MIGRADO → "${newFecha}"`);
                    migratedCount++;
                    migratedPedidos.push({
                        codigo: codigoPedido,
                        id: doc.id,
                        fecha_nueva: newFecha,
                        timestamp_anterior: JSON.stringify(currentFecha).substring(0, 80)
                    });
                }
                catch (updateErr) {
                    console.log(`❌ ${codigoPedido}: ERROR AL ACTUALIZAR - ${updateErr.message}`);
                    errorCount++;
                }
            }
            console.log(`\n📈 RESULTADO FINAL DE MIGRACIÓN:`);
            console.log(`   ✅ Migrados: ${migratedCount}`);
            console.log(`   ⏭️  Ya eran STRING: ${alreadyStringCount}`);
            console.log(`   ❌ Errores: ${errorCount}`);
            console.log(`\n✨ Migración completada\n`);
            return res.json({
                success: true,
                message: "Migración completada exitosamente",
                resultado: {
                    migrados: migratedCount,
                    yaEranString: alreadyStringCount,
                    errores: errorCount,
                    total: snapshot.size,
                    zonaHoraria: `UTC${UTC_OFFSET_HOURS}`,
                    pedidosMigrados: migratedPedidos
                }
            });
        }
        catch (error) {
            console.error(`[MIGRACIÓN] ERROR:`, error);
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });
}
//# sourceMappingURL=new-api.js.map