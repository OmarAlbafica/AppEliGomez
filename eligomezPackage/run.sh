#!/bin/bash

# Script para iniciar la app EliGomez sin Expo

set -e

PROJECT_DIR="/Users/grupoejje/Desktop/MobileReactNative/MiApp/eligomezPackage"

echo "🚀 Iniciando EliGomez App (React Native SIN EXPO)"
echo "────────────────────────────────────────────────"
echo ""

cd "$PROJECT_DIR"

# Verificar que npm install está hecho
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
    echo "✅ Dependencias instaladas"
    echo ""
fi

# Mostrar opciones
echo "Elige qué deseas hacer:"
echo "1) Iniciar Metro Server (npm start)"
echo "2) Ejecutar en Android (npm run android)"
echo "3) Ejecutar en iOS (npm run ios)"
echo ""

read -p "Selecciona una opción (1-3): " option

case $option in
    1)
        echo "▶️  Iniciando Metro Server..."
        npm start
        ;;
    2)
        echo "▶️  Ejecutando en Android..."
        npm run android
        ;;
    3)
        echo "▶️  Ejecutando en iOS..."
        npm run ios
        ;;
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac
