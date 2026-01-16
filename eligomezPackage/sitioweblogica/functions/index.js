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
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
// Inicializar Firebase Admin
admin.initializeApp();
// Crear app Express
const app = (0, express_1.default)();
// ✅ MIDDLEWARE CORS - APLICADO A TODAS LAS RUTAS
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json({ limit: "50mb" }));
// Log de configuración
console.log(`[Emulator Check]`);
console.log(`  FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST || 'No configurado'}`);
console.log(`  FIREBASE_STORAGE_EMULATOR_HOST: ${process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'No configurado'}`);
/**
 * Cloud Function para subir imágenes de productos
 */
app.post("/api/subirProducto", async (req, res) => {
    try {
        console.log(`[subirProducto] Iniciando...`);
        // Extraer datos del request
        const { archivoBase64, usuario_id, album, codigo } = req.body;
        console.log(`[subirProducto] Datos recibidos: usuario_id=${usuario_id}, album=${album}, codigo=${codigo}`);
        // Validar datos requeridos
        if (!archivoBase64 || !usuario_id || !album || !codigo) {
            console.error(`[subirProducto] Faltan parámetros`);
            res.status(400).json({ error: "Faltan parámetros requeridos" });
            return;
        }
        // Convertir base64 a Buffer
        console.log(`[subirProducto] Convirtiendo base64 a buffer...`);
        const buffer = Buffer.from(archivoBase64, "base64");
        console.log(`[subirProducto] Buffer size: ${buffer.length} bytes`);
        // Obtener referencia al bucket de Storage
        const bucket = admin.storage().bucket();
        // Subir imagen principal
        const storagePath = `productos/${usuario_id}/${album}/${codigo}.jpg`;
        console.log(`[subirProducto] Subiendo imagen a: ${storagePath}`);
        const file = bucket.file(storagePath);
        try {
            await file.save(buffer, {
                metadata: {
                    contentType: "image/jpeg",
                },
            });
            console.log(`[subirProducto] Imagen guardada exitosamente`);
        }
        catch (saveError) {
            console.error(`[subirProducto] Error al guardar imagen:`, saveError.message);
            throw saveError;
        }
        // Construir URL de descarga
        let url_imagen;
        try {
            const signedUrl = await file.getSignedUrl({
                version: "v4",
                action: "read",
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
            });
            url_imagen = signedUrl[0];
            console.log(`[subirProducto] URL firmada obtenida`);
        }
        catch (urlError) {
            console.warn(`[subirProducto] No se pudo obtener URL firmada:`, urlError.message);
            const bucket_name = bucket.name;
            url_imagen = `http://127.0.0.1:9200/storage/v1/b/${bucket_name}/o/${encodeURIComponent(storagePath)}?alt=media`;
        }
        // Crear thumbnail
        const thumbnailPath = `productos/${usuario_id}/${album}/${codigo}_thumb.jpg`;
        console.log(`[subirProducto] Creando thumbnail en: ${thumbnailPath}`);
        const thumbnailFile = bucket.file(thumbnailPath);
        try {
            await thumbnailFile.save(buffer, {
                metadata: {
                    contentType: "image/jpeg",
                },
            });
            console.log(`[subirProducto] Thumbnail guardado`);
        }
        catch (thumbError) {
            console.error(`[subirProducto] Error al guardar thumbnail:`, thumbError.message);
            throw thumbError;
        }
        // Obtener URL del thumbnail
        let url_thumbnail;
        try {
            const signedThumbUrl = await thumbnailFile.getSignedUrl({
                version: "v4",
                action: "read",
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
            });
            url_thumbnail = signedThumbUrl[0];
        }
        catch (thumbUrlError) {
            console.warn(`[subirProducto] No se pudo obtener URL de thumbnail:`, thumbUrlError.message);
            const bucket_name = bucket.name;
            url_thumbnail = `http://127.0.0.1:9200/storage/v1/b/${bucket_name}/o/${encodeURIComponent(thumbnailPath)}?alt=media`;
        }
        // Guardar metadata en Firestore
        console.log(`[subirProducto] Guardando metadata en Firestore...`);
        const db = admin.firestore();
        try {
            const docRef = await db.collection("productos").add({
                usuario_id,
                codigo,
                album,
                numero: parseInt(codigo.replace(/\D/g, "").slice(-1)) || 1,
                url_imagen,
                url_thumbnail,
                tamaño_original: buffer.length,
                tamaño_comprimido: buffer.length,
                fecha_carga: new Date(),
            });
            console.log(`[subirProducto] Producto guardado con ID: ${docRef.id}`);
        }
        catch (dbError) {
            console.error(`[subirProducto] Error al guardar en Firestore:`, dbError.message);
            throw dbError;
        }
        console.log(`[subirProducto] ✅ Exitoso!`);
        res.json({
            success: true,
            codigo,
            url_imagen,
            url_thumbnail,
            tamaño: buffer.length,
            mensaje: "Producto subido exitosamente",
        });
    }
    catch (error) {
        console.error(`[subirProducto] ❌ Error general:`, error);
        res.status(500).json({
            success: false,
            error: error.message || "Error al subir producto",
        });
    }
});
/**
 * Cloud Function para obtener productos de un usuario
 */
app.get("/api/obtenerProductos", async (req, res) => {
    try {
        const { usuario_id } = req.query;
        if (!usuario_id) {
            res.status(400).json({ error: "Falta el parámetro usuario_id" });
            return;
        }
        const db = admin.firestore();
        const snapshot = await db
            .collection("productos")
            .where("usuario_id", "==", usuario_id)
            .get();
        const productos = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        console.log(`[obtenerProductos] ✅ Productos obtenidos: ${productos.length}`);
        res.json({ success: true, productos });
    }
    catch (error) {
        console.error(`[obtenerProductos] ❌ Error:`, error);
        res.status(500).json({
            success: false,
            error: error.message || "Error al obtener productos",
        });
    }
});
/**
 * Exportar función como Cloud Function
 */
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map