#!/bin/bash

# 🚀 SCRIPT DE DEPLOYMENT - ELI GOMEZ APP
# Este script genera el APK en release y lo publica en Firebase App Distribution

set -e

PROJECT_DIR="/Users/grupoejje/Documents/GitHub/AppEliGomez/eligomezPackage"
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/release/app-release.apk"
FIREBASE_APP_ID="1:1030711833270:android:f95121a96dc5242c9e2c17"
FIREBASE_PROJECT="eli-gomez-web"
RELEASE_NOTES="🎉 Versión 1.0.2 - Headers Colapsables, Fechas Mejoradas, Auditoría de Estados. Cambios: ✅ Headers animados 280→100px en 6 pantallas ✅ Fechas en español (Jueves 20 de enero 2026) ✅ Cálculo de fecha estimada de envío (Mié/Sáb) ✅ Información completa de pedidos con emojis ✅ Modo personalizado (direcciones) ✅ Auditoría de cambios de estado (usuario_email) ✅ Settings modernizado ✅ Optimización: 1 petición en vez de 3 (estados múltiples)"
TESTERS="sr.vmago@gmail.com"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 DEPLOYMENT ELI GOMEZ APP${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
echo ""

# 1. GENERAR APK
echo -e "${YELLOW}[1/3] Generando APK en release...${NC}"
cd "$PROJECT_DIR"
./android/gradlew -p ./android app:assembleRelease

if [ ! -f "$APK_PATH" ]; then
    echo -e "${RED}❌ Error: APK no fue generado${NC}"
    exit 1
fi

APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
echo -e "${GREEN}✅ APK generado exitosamente (${APK_SIZE})${NC}"
echo ""

# 2. VERIFICAR FIREBASE LOGIN
echo -e "${YELLOW}[2/3] Verificando login en Firebase...${NC}"
FIREBASE_USER=$(firebase auth:list 2>/dev/null || echo "")
if [ -z "$FIREBASE_USER" ]; then
    echo -e "${YELLOW}⚠️  No estás logueado. Iniciando sesión...${NC}"
    firebase login
fi
echo -e "${GREEN}✅ Firebase verificado${NC}"
echo ""

# 3. PUBLICAR EN FIREBASE
echo -e "${YELLOW}[3/3] Publicando en Firebase App Distribution...${NC}"
firebase appdistribution:distribute "$APK_PATH" \
    --app="$FIREBASE_APP_ID" \
    --release-notes="$RELEASE_NOTES" \
    --testers="$TESTERS" \
    --project="$FIREBASE_PROJECT"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ App publicada exitosamente en Firebase${NC}"
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}🎉 DEPLOYMENT COMPLETADO${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}📦 APK: ${APK_PATH}${NC}"
    echo -e "${BLUE}🔗 Proyecto Firebase: ${FIREBASE_PROJECT}${NC}"
    echo -e "${BLUE}📱 App ID: ${FIREBASE_APP_ID}${NC}"
    echo ""
    echo -e "${YELLOW}🔗 Accede aquí para ver las releases:${NC}"
    echo -e "   https://console.firebase.google.com/project/${FIREBASE_PROJECT}/appdistribution"
    echo ""
else
    echo -e "${RED}❌ Error al publicar en Firebase${NC}"
    exit 1
fi
