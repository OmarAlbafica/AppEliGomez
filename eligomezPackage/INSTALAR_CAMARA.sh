#!/bin/bash

echo "📸 Instalando react-native-vision-camera (solución moderna y estable)"
echo "======================================================================"

cd /Users/grupoejje/Documents/GitHub/AppEliGomez/eligomezPackage

# 1. Desinstalar librerías viejas y problemáticas
echo "🗑️  Paso 1: Removiendo librerías antiguas..."
npm uninstall react-native-camera react-native-qrcode-scanner

# 2. Instalar react-native-vision-camera + plugin de escaneo
echo "📦 Paso 2: Instalando react-native-vision-camera v4..."
npm install react-native-vision-camera@^4.0.0
npm install vision-camera-code-scanner@^0.2.0

# 3. Configurar permisos Android
echo "⚙️  Paso 3: Configurando permisos Android..."

# Backup del AndroidManifest
cp android/app/src/main/AndroidManifest.xml android/app/src/main/AndroidManifest.xml.backup

# Agregar permisos de cámara si no existen
if ! grep -q "android.permission.CAMERA" android/app/src/main/AndroidManifest.xml; then
    sed -i '' '/<manifest/a\
    <uses-permission android:name="android.permission.CAMERA" />
' android/app/src/main/AndroidManifest.xml
fi

# 4. Limpiar y reconstruir
echo "🧹 Paso 4: Limpiando builds..."
cd android
./gradlew clean
cd ..
rm -rf android/app/build
rm -rf android/build

# 5. Reinstalar pods iOS
echo "🍎 Paso 5: Configurando iOS..."
cd ios
pod deintegrate 2>/dev/null || true
pod install
cd ..

echo ""
echo "✅ ¡Instalación completa!"
echo ""
echo "📝 Próximos pasos:"
echo "1. Verifica que no haya errores"
echo "2. Ejecuta: npm start -- --reset-cache"
echo "3. En otra terminal: npm run android"
echo ""
