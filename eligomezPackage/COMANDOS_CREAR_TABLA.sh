#!/bin/bash

echo "📊 Pasos para crear la colección remuneraciones_diarias"
echo ""
echo "1️⃣ Descarga las credenciales:"
echo "   - Ve a: https://console.firebase.google.com/project/eli-gomez-web/settings/serviceaccounts/adminsdk"
echo "   - Haz clic en 'Generate New Private Key'"
echo "   - Se descargará un archivo JSON"
echo ""
echo "2️⃣ Copia el archivo a la raíz del proyecto:"
echo "   cp ~/Downloads/eli-gomez-web-firebase-adminsdk-*.json ./firebase-service-account.json"
echo ""
echo "3️⃣ Instala firebase-admin:"
npm install firebase-admin
echo ""
echo "4️⃣ Ejecuta el script:"
node scripts/crear-coleccion-remuneraciones.js
echo ""
