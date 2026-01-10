# EliGomez App - React Native SIN EXPO

## 📱 Descripción
Proyecto React Native **100% sin Expo**. Es un proyecto nativo completo con estructuras de Android e iOS listos para compilar y ejecutar.

## 📁 Ubicación
`/Users/grupoejje/Desktop/MobileReactNative/MiApp/eligomezPackage`

---

## 🚀 Instalación

Las dependencias ya están instaladas, pero si necesitas reinstalar:

```bash
cd /Users/grupoejje/Desktop/MobileReactNative/MiApp/eligomezPackage
npm install
```

---

## ▶️ Ejecutar el Proyecto

### **Metro Server (primero en una terminal)**
```bash
npm start
```

### **En otra terminal - Android**
```bash
npm run android
```

### **En otra terminal - iOS**
```bash
npm run ios
```

---

## 🔧 Requisitos

### Para Android:
- ✅ JDK instalado
- ✅ Android Studio
- ✅ Android SDK
- ✅ Un emulador Android ejecutándose O un dispositivo conectado

### Para iOS:
- ✅ Xcode
- ✅ CocoaPods
- ✅ macOS

---

## 📂 Estructura del Proyecto

```
eligomezPackage/
├── App.tsx                  ← Componente principal
├── index.js                 ← Punto de entrada
├── package.json             ← Dependencias
├── tsconfig.json            ← Configuración TypeScript
├── metro.config.js          ← Configuración del bundler
├── babel.config.js          ← Configuración de Babel
├── android/                 ← Código nativo Android
│   ├── app/
│   ├── build.gradle
│   └── settings.gradle
├── ios/                     ← Código nativo iOS
│   ├── eligomezPackage/
│   ├── eligomezPackage.xcodeproj
│   └── Podfile
└── __tests__/               ← Tests
```

---

## ✅ ¿Por qué funciona mejor así?

1. **Sin Expo** → Sin dependencias extra
2. **Control total** → Acceso a código nativo
3. **Más ligero** → Mejor rendimiento
4. **Compatible** → Funciona igual que cualquier app React Native

---

## 🐛 Si tienes problemas:

```bash
# Limpiar caché
npm start -- --reset-cache

# Reinstalar node_modules
rm -rf node_modules package-lock.json
npm install

# Para Android, limpiar Gradle
cd android && ./gradlew clean && cd ..

# Para iOS, limpiar Xcode
xcode-select --reset
```

---

## 📖 Links útiles

- [React Native Docs](https://reactnative.dev)
- [Metro Bundler](https://facebook.github.io/metro/)
- [Android Setup](https://reactnative.dev/docs/environment-setup)
- [iOS Setup](https://reactnative.dev/docs/environment-setup)

---

**Creado:** 9 de Enero 2026
**Version:** React Native 0.83.1
