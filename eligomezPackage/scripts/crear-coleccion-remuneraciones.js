#!/usr/bin/env node

/**
 * 📊 Script para crear colección remuneraciones_diarias en Firestore
 * 
 * Uso:
 *   node scripts/crear-coleccion-remuneraciones.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Configurar credenciales de Firebase Admin
// Descarga el archivo JSON desde Firebase Console > Project Settings > Service Accounts
const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://eli-gomez-web.firebaseapp.com"
  });
} catch (error) {
  console.error('❌ Error: No se encontró firebase-service-account.json');
  console.error('Por favor descarga el archivo desde Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const db = admin.firestore();

async function crearColeccionRemuneraciones() {
  try {
    console.log('\n📊 Creando colección remuneraciones_diarias...\n');

    // Crear documento de ejemplo
    const hoy = new Date();
    const fecha = hoy.getFullYear() + '-' + 
                  String(hoy.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(hoy.getDate()).padStart(2, '0');

    const docRef = db.collection('remuneraciones_diarias').doc(`${fecha}_ejemplo`);
    
    await docRef.set({
      pedido_id: 'PED-EJEMPLO-123',
      tipo: 'retirado',
      monto: 100,
      usuario_nombre: 'BETTY',
      encomiendista_nombre: 'Mia Belen',
      fecha: fecha,
      timestamp: new Date().toISOString(),
      creado_por: 'script_setup'
    });

    console.log('✅ Colección creada exitosamente');
    console.log('✅ Documento de ejemplo insertado');
    console.log('\n📋 Estructura de datos:');
    console.log('  - pedido_id (string): ID del pedido');
    console.log('  - tipo (string): "retirado" o "no-retirado"');
    console.log('  - monto (number): cantidad remunerada');
    console.log('  - usuario_nombre (string): nombre de quien remunera (BETTY, OMAR, etc)');
    console.log('  - encomiendista_nombre (string): nombre del encomendista');
    console.log('  - fecha (string): YYYY-MM-DD');
    console.log('  - timestamp (string): ISO 8601 timestamp');
    console.log('\n✨ ¡Listo para usar!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error creando colección:', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  }
}

// Ejecutar
crearColeccionRemuneraciones();
