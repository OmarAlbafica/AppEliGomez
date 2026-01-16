# 📱 Guía de Deploy iOS a Firebase

## ✅ Completado

1. **GoogleService-Info.plist** - Creado en `/ios/` con los datos de tu proyecto Firebase
2. **Bundle ID** - Configurado: `com.eligpackage`
3. **Script de Deploy** - Creado en `deploy-ios.sh`

---

## 🚨 Antes de ejecutar el deploy, necesitas:

### 1. Obtener tu Team ID de Apple
```bash
# En Xcode, ve a:
# Xcode > Preferences > Accounts > [Tu Apple ID] > Teams
# Copia el Team ID (formato: ABC123XYZ1)
```

### 2. Actualizar el Team ID en el script
```bash
# En el archivo deploy-ios.sh, busca la línea:
<key>teamID</key>
<string>YOUR_TEAM_ID</string>

# Y reemplaza YOUR_TEAM_ID con tu ID real, ejemplo:
<string>ABC123XYZ1</string>
```

### 3. Asegurar que tienes certificados de distribución
```bash
# En Xcode:
# Signing & Capabilities > Team > eligomezPackage
# Verifica que tengas un certificado válido
```

---

## 🚀 Para publicar a Firebase

Una vez que tengas todo configurado:

```bash
cd /Users/grupoejje/Documents/GitHub/AppEliGomez/eligomezPackage
./deploy-ios.sh
```

El script hará:
1. ✅ Compilar la app en modo Release
2. ✅ Crear el archivo .ipa
3. ✅ Publicar en Firebase App Distribution
4. ✅ Enviar invitación a: sr.vmago@gmail.com

---

## 📧 Archivos de Configuración

- **GoogleService-Info.plist** - Ya configurado ✅
- **deploy-ios.sh** - Script de build y publish ✅
- **Team ID** - Necesita actualización manual ⏳

---

## 🔍 Alternativa Manual (si el script falla)

```bash
# 1. Build
cd /Users/grupoejje/Documents/GitHub/AppEliGomez/eligomezPackage/ios
xcodebuild -workspace eligomezPackage.xcworkspace -scheme eligomezPackage -configuration Release -archivePath ../build/eligomezPackage.xcarchive archive

# 2. Export .ipa
xcodebuild -exportArchive -archivePath ../build/eligomezPackage.xcarchive -exportOptionsPlist ExportOptions.plist -exportPath ../build/ipa

# 3. Publish
firebase appdistribution:distribute ../build/ipa/eligomezPackage.ipa --app=1:1030711833270:ios:f95121a96dc5242c9e2c17 --release-notes="Tu mensaje aquí" --testers=sr.vmago@gmail.com --project=eli-gomez-web
```

---

## 📝 Estado del Proyecto Firebase

- **Proyecto:** eli-gomez-web ✅
- **App Android:** Registrada ✅
- **App Web:** Registrada ✅
- **App iOS:** Lista para crear ⏳
- **GoogleService-Info.plist:** Creado ✅
- **Firebase CLI:** Instalado (v15.2.1) ✅
