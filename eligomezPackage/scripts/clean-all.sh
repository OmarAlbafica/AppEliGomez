#!/bin/bash

# Script MASTER: Limpia TODO para empezar de cero
echo "🚀 LIMPIEZA TOTAL - Matando procesos y limpiando cachés..."

# 1. Cerrar Metro
echo "🔴 Cerrando Metro y procesos Node..."
pkill -f "metro" || true
pkill -f "node.*8081" || true
pkill -f "npm run start" || true
pkill -f "react-native start" || true
lsof -i :8081 | grep -v COMMAND | awk '{print $2}' | xargs kill -9 2>/dev/null || true
echo "✅ Metro cerrado"

# 2. Limpiar caché React Native
echo "🧹 Limpiando caché de React Native..."
rm -rf ~/.npm
watchman watch-del-all 2>/dev/null || true
echo "✅ Caché React Native limpio"

# 3. Limpiar DerivedData Xcode
echo "🗑️ Limpiando DerivedData Xcode..."
rm -rf ~/Library/Developer/Xcode/DerivedData/eligomezPackage*
echo "✅ DerivedData limpiado"

# 4. Limpiar Gradle/Android
echo "🧹 Limpiando caché Gradle..."
rm -rf ~/.gradle/caches
rm -rf ./android/build
rm -rf ./android/app/build/outputs
echo "✅ Gradle limpio"

# 5. Limpiar iOS Pods y build
echo "🧹 Limpiando Pods iOS..."
cd ./ios
rm -rf Pods
rm -rf Podfile.lock
rm -rf build
cd ..
echo "✅ Pods limpiado"

# Fin
echo ""
echo "════════════════════════════════════════════"
echo "✅ LIMPIEZA TOTAL COMPLETADA"
echo "════════════════════════════════════════════"
echo ""
echo "Para volver a instalar:"
echo "  iOS:     npm install && cd ios && pod install && cd .."
echo "  Android: npm install"
echo ""
