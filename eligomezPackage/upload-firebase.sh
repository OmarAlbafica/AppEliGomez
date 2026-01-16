#!/bin/bash

# Script para subir la app iOS a Firebase App Distribution
# Uso: ./upload-firebase.sh "nota de release"

set -e

PROJECT_ID="eli-gomez-web"
APP_ID="1:1030711833270:ios:ab9abc087eb400649e2c17"
TESTERS="sr.vmago@gmail.com"

# Argumentos
RELEASE_NOTES="${1:-🎉 Nueva versión de EliGomez}"

# Rutas
ARCHIVE_PATH=$(find ~/Library/Developer/Xcode/Archives -name "*eligomez*" -type d | head -1)
EXPORT_PATH="/tmp/eligomez_ipa"
IPA_FILE="$EXPORT_PATH/EliGPackage.ipa"

echo "📦 Exportando archivo..."
if [ -z "$ARCHIVE_PATH" ]; then
  echo "❌ Error: No se encontró archivo .xcarchive"
  exit 1
fi

# Crear directorio de exportación
mkdir -p "$EXPORT_PATH"

# Exportar a .ipa
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist /tmp/ExportOptions.plist \
  -exportPath "$EXPORT_PATH" 2>&1 | grep -E "(Exported|EXPORT SUCCEEDED|error)" || true

if [ ! -f "$IPA_FILE" ]; then
  echo "❌ Error: No se pudo crear el archivo .ipa"
  exit 1
fi

echo "✅ IPA generado: $IPA_FILE ($(du -h "$IPA_FILE" | cut -f1))"
echo ""
echo "📱 Subiendo a Firebase App Distribution..."
echo "Release Notes: $RELEASE_NOTES"
echo "Testers: $TESTERS"
echo ""

# Subir a Firebase
firebase appdistribution:distribute "$IPA_FILE" \
  --app="$APP_ID" \
  --release-notes="$RELEASE_NOTES" \
  --testers="$TESTERS" \
  --project="$PROJECT_ID" 2>&1

echo ""
echo "✅ ¡Subida completada!"
echo "Los testers recibirán un email con el enlace de descarga"
