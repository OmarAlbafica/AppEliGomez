#!/bin/bash

# Script para limpiar caché de Gradle (Android)
echo "🧹 Limpiando caché de Gradle (Android)..."

rm -rf ~/.gradle/caches
echo "✅ Gradle caches limpiado"

# Limpiar build de Android
rm -rf ./android/build
echo "✅ Android build limpiado"

# Limpiar outputs
rm -rf ./android/app/build/outputs
echo "✅ Android app outputs limpiado"

echo "✅ Caché de Gradle limpio"
