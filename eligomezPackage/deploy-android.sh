#!/bin/bash

# 🚀 SCRIPT DE DEPLOYMENT - ELI GOMEZ APP (ANDROID)
# Genera el APK en release y lo publica en Firebase App Distribution

set -e

PROJECT_DIR="/Users/grupoejje/Documents/GitHub/AppEliGomez/eligomezPackage"
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"
FIREBASE_APP_ID="1:1030711833270:android:f95121a96dc5242c9e2c17"
FIREBASE_PROJECT="eli-gomez-web"
RELEASE_NOTES="📦 v1.0.18 - Marcar pedidos como retirado directamente en la pantalla de hoy"
TESTERS="sr.vmago@gmail.com"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 DEPLOYMENT ANDROID - ELI GOMEZ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# 1. GENERAR APK
echo -e "${YELLOW}[1/3] Compilando APK en release...${NC}"
cd "$PROJECT_DIR"
./android/gradlew -p ./android clean app:assembleRelease 2>&1 | grep -E "(BUILD|error|warning)" || true

if [ ! -f "$APK_PATH" ]; then
    echo -e "${RED}❌ Error: APK no generado${NC}"
    exit 1
fi

APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
echo -e "${GREEN}✅ APK generado: $APK_SIZE${NC}"
echo ""

# 2. PUBLICAR EN FIREBASE
echo -e "${YELLOW}[2/3] Subiendo a Firebase App Distribution...${NC}"
firebase appdistribution:distribute "$APK_PATH" \
    --app="$FIREBASE_APP_ID" \
    --release-notes="$RELEASE_NOTES" \
    --testers="$TESTERS" \
    --project="$FIREBASE_PROJECT"

echo ""
echo -e "${GREEN}🎉 DEPLOYMENT ANDROID COMPLETADO${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
