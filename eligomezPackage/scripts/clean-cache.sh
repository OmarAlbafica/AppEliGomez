#!/bin/bash

# Script para limpiar caché de React Native
echo "🧹 Limpiando caché de React Native..."

# Limpiar caché de npm
rm -rf ~/.npm
echo "✅ npm cache limpiado"

# Limpiar caché de Watchman
watchman watch-del-all 2>/dev/null || true
echo "✅ Watchman cache limpiado"

# Limpiar node_modules y package-lock si quieres
# Descomentar si es necesario:
# rm -rf node_modules
# rm package-lock.json

echo "✅ Caché de React Native limpio"
