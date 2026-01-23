"use strict";
/**
 * Script de migración: Convierte fecha_entrega_programada de Timestamp a String (YYYY-MM-DD)
 * Respeta la zona horaria local (UTC-6)
 *
 * EJECUTAR: npx ts-node migrate-timestamps-to-strings.ts
 */
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
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
// Inicializar Firebase
const serviceAccountPath = path.join(__dirname, '..', 'eli-gomez-web-firebase-adminsdk.json');
const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();
// Zona horaria del usuario (UTC-6 para Costa Rica)
const UTC_OFFSET_HOURS = -6;
function convertTimestampToLocalDateString(timestamp) {
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
    if (segundos === null) {
        console.log(`❌ No se pudo extraer segundos de: ${JSON.stringify(timestamp)}`);
        return null;
    }
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
async function migratePedidos() {
    console.log(`\n🔄 INICIANDO MIGRACIÓN: Timestamp → String (UTC${UTC_OFFSET_HOURS})\n`);
    try {
        const snapshot = await db.collection('pedidos').get();
        console.log(`📊 Total de pedidos a procesar: ${snapshot.size}\n`);
        let migratedCount = 0;
        let errorCount = 0;
        let skipCount = 0;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const codigoPedido = data.codigo_pedido || 'DESCONOCIDO';
            const currentFecha = data.fecha_entrega_programada;
            // Si ya es string, omitir
            if (typeof currentFecha === 'string') {
                console.log(`⏭️  ${codigoPedido}: YA ES STRING → "${currentFecha}"`);
                skipCount++;
                continue;
            }
            // Convertir timestamp a string
            const newFecha = convertTimestampToLocalDateString(currentFecha);
            if (!newFecha) {
                console.log(`❌ ${codigoPedido}: NO SE PUDO CONVERTIR`);
                errorCount++;
                continue;
            }
            // Actualizar en Firestore
            try {
                await db.collection('pedidos').doc(doc.id).update({
                    fecha_entrega_programada: newFecha
                });
                console.log(`✅ ${codigoPedido}: ${JSON.stringify(currentFecha)} → "${newFecha}"`);
                migratedCount++;
            }
            catch (updateErr) {
                console.log(`❌ ${codigoPedido}: ERROR AL ACTUALIZAR - ${updateErr}`);
                errorCount++;
            }
        }
        console.log(`\n📈 RESULTADO DE MIGRACIÓN:`);
        console.log(`   ✅ Migrados: ${migratedCount}`);
        console.log(`   ⏭️  Ya eran string: ${skipCount}`);
        console.log(`   ❌ Errores: ${errorCount}`);
        console.log(`\n✨ Migración completada\n`);
    }
    catch (error) {
        console.error(`❌ ERROR DURANTE MIGRACIÓN:`, error);
    }
    finally {
        await admin.app().delete();
    }
}
// Ejecutar migración
migratePedidos();
//# sourceMappingURL=migrate-timestamps-to-strings.js.map