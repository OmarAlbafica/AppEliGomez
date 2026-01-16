#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

set -e

PROJECT_PATH="/Users/grupoejje/Documents/GitHub/AppEliGomez/eligomezPackage"
IOS_PATH="$PROJECT_PATH/ios"
BUILD_OUTPUT="$IOS_PATH/build"
WORKSPACE="$IOS_PATH/eligomezPackage.xcworkspace"
SCHEME="eligomezPackage"
CONFIGURATION="Release"
DERIVED_DATA="$BUILD_OUTPUT/DerivedData"

echo -e "${YELLOW}🔨 Iniciando build de iOS para Firebase...${NC}"

# Step 1: Clean and prepare
echo -e "${YELLOW}📦 Limpiando builds anteriores...${NC}"
rm -rf "$BUILD_OUTPUT" "$DERIVED_DATA"
mkdir -p "$BUILD_OUTPUT"

# Step 2: Build the iOS app for distribution
echo -e "${YELLOW}🏗️  Compilando app en configuración Release...${NC}"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -derivedDataPath "$DERIVED_DATA" \
  -archivePath "$BUILD_OUTPUT/eligomezPackage.xcarchive" \
  -allowProvisioningUpdates \
  SWIFT_VERSION=5.0 \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY="Apple Development" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  archive

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error durante la compilación${NC}"
  exit 1
fi

echo -e "${GREEN}✅ App archivada exitosamente${NC}"

# Step 3: Export the .ipa file
echo -e "${YELLOW}📄 Exportando .ipa para distribución...${NC}"

# Create export options plist
cat > "$BUILD_OUTPUT/ExportOptions.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>development</string>
    <key>teamID</key>
    <string>W8XBZHAPB7</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>thinning</key>
    <string>&lt;none&gt;</string>
</dict>
</plist>
EOF

xcodebuild \
  -exportArchive \
  -archivePath "$BUILD_OUTPUT/eligomezPackage.xcarchive" \
  -exportOptionsPlist "$BUILD_OUTPUT/ExportOptions.plist" \
  -exportPath "$BUILD_OUTPUT/ipa"

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Error exportando .ipa${NC}"
  exit 1
fi

IPA_FILE=$(find "$BUILD_OUTPUT/ipa" -name "*.ipa" | head -1)

if [ -z "$IPA_FILE" ]; then
  echo -e "${RED}❌ No se encontró el archivo .ipa${NC}"
  exit 1
fi

echo -e "${GREEN}✅ .ipa creado: $IPA_FILE${NC}"

# Step 4: Publish to Firebase App Distribution
echo -e "${YELLOW}🚀 Publicando en Firebase App Distribution...${NC}"

# Extract version from app
VERSION=$(defaults read "$BUILD_OUTPUT/DerivedData/Build/Products/$CONFIGURATION-iphoneos/eligomezPackage.app/Info.plist" CFBundleShortVersionString 2>/dev/null || echo "1.0.0")

RELEASE_NOTES="🎉 Versión $VERSION - Build Release para Testing

✨ Cambios:
- Headers Colapsables
- Filtrado por Fechas (sin horas)
- Auditoría de Estados
- Optimización de Performance

📧 Contacta a sr.vmago@gmail.com si tienes problemas"

firebase appdistribution:distribute "$IPA_FILE" \
  --app=1:1030711833270:ios:f95121a96dc5242c9e2c17 \
  --release-notes="$RELEASE_NOTES" \
  --testers=sr.vmago@gmail.com \
  --project=eli-gomez-web

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ ¡App publicada exitosamente en Firebase!${NC}"
  echo -e "${GREEN}📱 Los testers recibirán la invitación en su email${NC}"
else
  echo -e "${RED}❌ Error publicando en Firebase${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Process completado${NC}"
