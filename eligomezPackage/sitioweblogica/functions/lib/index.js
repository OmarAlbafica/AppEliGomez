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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiV2 = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const new_api_1 = require("./new-api");
// Inicializar Firebase Admin
admin.initializeApp();
// Crear app Express
const app = (0, express_1.default)();
// ✅ MIDDLEWARE CORS
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json({ limit: "50mb" }));
console.log(`[API] Starting new API version using Firestore...`);
// Registrar endpoints optimizados de new-api.ts
(0, new_api_1.registerOptimizedAPI)(app);
/**
 * Subir producto - Guarda imagen base64 en Firestore (V2)
 */
app.post("/api/v2/subirProducto", async (req, res) => {
    try {
        console.log(`[API V2] POST /api/v2/subirProducto`);
        const { archivoBase64, usuario_id, album, codigo } = req.body;
        if (!archivoBase64 || !usuario_id || !album || !codigo) {
            return res.status(400).json({
                success: false,
                error: "Missing: archivoBase64, usuario_id, album, codigo"
            });
        }
        const db = admin.firestore();
        const docId = `${usuario_id}_${album}_${codigo}`;
        console.log(`[API] Saving to Firestore: ${docId}`);
        await db.collection('imagenes_productos').doc(docId).set({
            usuario_id,
            album,
            codigo,
            archivoBase64,
            fecha_carga: new Date(),
            tamaño: Buffer.from(archivoBase64, 'base64').length
        });
        console.log(`[API] ✅ Success`);
        return res.json({
            success: true,
            message: "Image saved successfully",
            url_imagen: `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/obtenerProducto/${usuario_id}/${album}/${codigo}`,
            url_thumbnail: `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/obtenerProducto/${usuario_id}/${album}/${codigo}?thumb=true`,
            docId
        });
    }
    catch (error) {
        console.error(`[API] Error:`, error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Obtener imagen desde Firestore
 */
app.get("/api/obtenerProducto/:usuario_id/:album/:codigo", async (req, res) => {
    try {
        const { usuario_id, album, codigo } = req.params;
        const db = admin.firestore();
        const docId = `${usuario_id}_${album}_${codigo}`;
        console.log(`[API] GET obtenerProducto: ${docId}`);
        const doc = await db.collection('imagenes_productos').doc(docId).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, error: "Not found" });
        }
        const base64Data = doc.data()?.archivoBase64;
        if (!base64Data) {
            return res.status(404).json({ success: false, error: "No image data" });
        }
        const buffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(buffer);
    }
    catch (error) {
        console.error(`[API] Error:`, error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * Obtener productos del usuario
 */
app.get("/api/obtenerProductos", async (req, res) => {
    try {
        const { usuario_id } = req.query;
        if (!usuario_id) {
            return res.status(400).json({ error: "Missing usuario_id" });
        }
        const db = admin.firestore();
        const snapshot = await db
            .collection("imagenes_productos")
            .where("usuario_id", "==", usuario_id)
            .get();
        const productos = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        console.log(`[API] obtenerProductos: ${productos.length} encontrados`);
        res.json({ success: true, productos });
    }
    catch (error) {
        console.error(`[API] Error:`, error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * Subir imagen de tienda - Guarda en colección separada (V2)
 */
app.post("/api/v2/subirImagenTienda", async (req, res) => {
    try {
        console.log(`[API V2] POST /api/v2/subirImagenTienda`);
        const { archivoBase64, usuario_id, nombreTienda, nombreArchivo } = req.body;
        if (!archivoBase64 || !usuario_id || !nombreTienda) {
            return res.status(400).json({
                success: false,
                error: "Missing: archivoBase64, usuario_id, nombreTienda"
            });
        }
        const db = admin.firestore();
        const docId = `${usuario_id}_${nombreTienda}_${nombreArchivo || new Date().getTime()}`;
        console.log(`[API] Saving tienda image to Firestore: ${docId}`);
        await db.collection('imagenes_tiendas').doc(docId).set({
            usuario_id,
            nombreTienda,
            nombreArchivo: nombreArchivo || new Date().getTime().toString(),
            archivoBase64,
            fecha_carga: new Date(),
            tamaño: Buffer.from(archivoBase64, 'base64').length
        });
        console.log(`[API] ✅ Tienda image saved successfully`);
        return res.json({
            success: true,
            message: "Tienda image saved successfully",
            urlDescargable: `https://us-central1-eli-gomez-web.cloudfunctions.net/apiV2/api/obtenerTienda/${usuario_id}/${nombreTienda}/${nombreArchivo || new Date().getTime()}`,
            docId
        });
    }
    catch (error) {
        console.error(`[API] Error:`, error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * Obtener imagen de tienda desde Firestore
 */
app.get("/api/obtenerTienda/:usuario_id/:nombreTienda/:nombreArchivo", async (req, res) => {
    try {
        const { usuario_id, nombreTienda, nombreArchivo } = req.params;
        const db = admin.firestore();
        const docId = `${usuario_id}_${nombreTienda}_${nombreArchivo}`;
        console.log(`[API] GET obtenerTienda: ${docId}`);
        const doc = await db.collection('imagenes_tiendas').doc(docId).get();
        if (!doc.exists) {
            return res.status(404).json({ success: false, error: "Tienda image not found" });
        }
        const base64Data = doc.data()?.archivoBase64;
        if (!base64Data) {
            return res.status(404).json({ success: false, error: "No image data" });
        }
        const buffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(buffer);
    }
    catch (error) {
        console.error(`[API] Error:`, error);
        return res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * Exportar Cloud Function
 */
exports.apiV2 = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map