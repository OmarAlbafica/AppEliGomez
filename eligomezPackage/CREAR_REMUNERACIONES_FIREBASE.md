# 📊 Crear Colección de Remuneraciones en Firebase

## Pasos:

### 1. Descargar credenciales de Firebase
- Ve a [Firebase Console](https://console.firebase.google.com)
- Selecciona el proyecto **eli-gomez-web**
- Ve a **Project Settings** (ícono de engranaje)
- Abre la pestaña **Service Accounts**
- Haz clic en **Generate New Private Key**
- Se descargará un archivo JSON

### 2. Copiar el archivo JSON
```bash
# El archivo descargado es algo como: eli-gomez-web-firebase-adminsdk-xxxxx.json
# Cópialo a la raíz del proyecto con este nombre exacto:
cp ~/Downloads/eli-gomez-web-firebase-adminsdk-*.json ./firebase-service-account.json
```

### 3. Instalar firebase-admin (si no está ya instalado)
```bash
cd eligomezPackage
npm install firebase-admin
```

### 4. Ejecutar el script
```bash
node scripts/crear-coleccion-remuneraciones.js
```

### 5. Verificar en Firebase Console
- Ve a [Firestore Database](https://console.firebase.google.com/project/eli-gomez-web/firestore/data)
- Deberías ver la colección `remuneraciones_diarias` con un documento de ejemplo

## Estructura de datos

```
remuneraciones_diarias/
├── 2026-01-18_ejemplo
│   ├── pedido_id: "PED-EJEMPLO-123" (string)
│   ├── tipo: "retirado" (string: "retirado" | "no-retirado")
│   ├── monto: 100 (number)
│   ├── usuario_nombre: "BETTY" (string)
│   ├── encomiendista_nombre: "Mia Belen" (string)
│   ├── fecha: "2026-01-18" (string YYYY-MM-DD)
│   └── timestamp: "2026-01-18T14:30:45.123Z" (string ISO)
```

## Índices recomendados

En Firebase Console, crear estos índices en **Firestore Indexes**:

1. **Búsqueda por fecha y usuario**
   - Collection: `remuneraciones_diarias`
   - Fields: `fecha` (Ascending), `usuario_nombre` (Ascending)

2. **Búsqueda por fecha y tipo**
   - Collection: `remuneraciones_diarias`
   - Fields: `fecha` (Ascending), `tipo` (Ascending)

3. **Búsqueda por fecha y encomendista**
   - Collection: `remuneraciones_diarias`
   - Fields: `fecha` (Ascending), `encomiendista_nombre` (Ascending)

## Troubleshooting

Si ves este error:
```
Error: PERMISSION_DENIED: Missing or insufficient permissions
```

Ve a **Firestore > Rules** y asegúrate de tener:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

O si quieres permitir todo (⚠️ solo para desarrollo):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write;
    }
  }
}
```
