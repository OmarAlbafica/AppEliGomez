// ============================================
// SCRIPT DE INICIALIZACIÓN FIRESTORE
// ============================================
// Este archivo contiene ejemplos de código para inicializar Firestore
// con datos de destinos y franjas de entrega.
// 
// USO: 
// 1. Copiar el contenido (sin imports que no resuelvan)
// 2. Pegar en la consola del navegador en tu app Firebase
// 3. Ejecutar: await inicializarFirestore()
//
// NOTA: Requiere que 'db' esté disponible globalmente
// ============================================

// Interfaces de ejemplo
interface Destino {
  nombre: string;
  costo: number;
  activo: boolean;
  fecha_creacion: Date;
}

interface FranjaData {
  destino_id: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  fecha_creacion: Date;
}

// Datos de destinos
const DESTINOS: { nombre: string; costo: number }[] = [
  { nombre: 'San Pedro Noveaico', costo: 13.50 },
  { nombre: 'Casillero 1-4 A', costo: 13.50 },
  { nombre: 'Santa Ana Plaza Paris', costo: 15.00 },
  { nombre: 'Ciudad Real', costo: 20.00 },
  { nombre: 'Metapán', costo: 18.50 },
  { nombre: 'Parque Centenario', costo: 15.50 },
  { nombre: 'El Tránsito', costo: 14.00 },
  { nombre: 'Cojutepeque', costo: 25.00 },
  { nombre: 'San Miguel', costo: 30.00 }
];

// Datos de franjas
const FRANJAS_DATA: { destino: string; dia: string; hora_inicio: string; hora_fin: string }[] = [
  // San Pedro Noveaico
  { destino: 'San Pedro Noveaico', dia: 'Lunes', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'San Pedro Noveaico', dia: 'Lunes', hora_inicio: '14:00', hora_fin: '17:00' },
  { destino: 'San Pedro Noveaico', dia: 'Martes', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'San Pedro Noveaico', dia: 'Miércoles', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'San Pedro Noveaico', dia: 'Jueves', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'San Pedro Noveaico', dia: 'Viernes', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'San Pedro Noveaico', dia: 'Viernes', hora_inicio: '14:00', hora_fin: '17:00' },
  { destino: 'San Pedro Noveaico', dia: 'Sábado', hora_inicio: '09:00', hora_fin: '12:00' },
  
  // Casillero 1-4 A
  { destino: 'Casillero 1-4 A', dia: 'Lunes', hora_inicio: '10:00', hora_fin: '13:00' },
  { destino: 'Casillero 1-4 A', dia: 'Miércoles', hora_inicio: '10:00', hora_fin: '13:00' },
  { destino: 'Casillero 1-4 A', dia: 'Sábado', hora_inicio: '10:00', hora_fin: '13:00' },
  
  // Santa Ana Plaza Paris
  { destino: 'Santa Ana Plaza Paris', dia: 'Martes', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'Santa Ana Plaza Paris', dia: 'Jueves', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'Santa Ana Plaza Paris', dia: 'Domingo', hora_inicio: '10:00', hora_fin: '14:00' },
  
  // Ciudad Real
  { destino: 'Ciudad Real', dia: 'Lunes', hora_inicio: '08:00', hora_fin: '11:00' },
  { destino: 'Ciudad Real', dia: 'Miércoles', hora_inicio: '08:00', hora_fin: '11:00' },
  { destino: 'Ciudad Real', dia: 'Viernes', hora_inicio: '08:00', hora_fin: '11:00' },
  
  // Metapán
  { destino: 'Metapán', dia: 'Lunes', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'Metapán', dia: 'Miércoles', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'Metapán', dia: 'Sábado', hora_inicio: '10:00', hora_fin: '13:00' },
  
  // Parque Centenario
  { destino: 'Parque Centenario', dia: 'Martes', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'Parque Centenario', dia: 'Jueves', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'Parque Centenario', dia: 'Domingo', hora_inicio: '10:00', hora_fin: '13:00' },
  
  // El Tránsito
  { destino: 'El Tránsito', dia: 'Lunes', hora_inicio: '09:00', hora_fin: '12:00' },
  { destino: 'El Tránsito', dia: 'Viernes', hora_inicio: '09:00', hora_fin: '12:00' },
  
  // Cojutepeque
  { destino: 'Cojutepeque', dia: 'Lunes', hora_inicio: '07:00', hora_fin: '10:00' },
  { destino: 'Cojutepeque', dia: 'Jueves', hora_inicio: '07:00', hora_fin: '10:00' },
  { destino: 'Cojutepeque', dia: 'Sábado', hora_inicio: '08:00', hora_fin: '11:00' },
  
  // San Miguel
  { destino: 'San Miguel', dia: 'Martes', hora_inicio: '07:00', hora_fin: '10:00' },
  { destino: 'San Miguel', dia: 'Jueves', hora_inicio: '07:00', hora_fin: '10:00' },
  { destino: 'San Miguel', dia: 'Viernes', hora_inicio: '07:00', hora_fin: '10:00' }
];

// ============================================
// FUNCIÓN PARA INICIALIZAR
// ============================================
async function inicializarFirestore(dbInstance: any) {
  try {
    console.log('=== INICIALIZANDO FIRESTORE ===\n');
    
    // Insertar destinos
    const destinosIds: { [key: string]: string } = {};
    console.log('Insertando destinos...');
    for (const destino of DESTINOS) {
      const docRef = await dbInstance.collection('destinos').add({
        ...destino,
        activo: true,
        fecha_creacion: new Date()
      });
      destinosIds[destino.nombre] = docRef.id;
      console.log(`  ✓ ${destino.nombre} (ID: ${docRef.id})`);
    }
    
    // Insertar franjas
    console.log('\nInsertando franjas de entrega...');
    for (const franja of FRANJAS_DATA) {
      const destino_id = destinosIds[franja.destino];
      if (destino_id) {
        await dbInstance.collection('franjas-entrega').add({
          destino_id,
          dia: franja.dia,
          hora_inicio: franja.hora_inicio,
          hora_fin: franja.hora_fin,
          activo: true,
          fecha_creacion: new Date()
        });
      }
    }
    
    console.log(`\n✅ Inicialización completada`);
    console.log(`   Total destinos: ${Object.keys(destinosIds).length}`);
    console.log(`   Total franjas: ${FRANJAS_DATA.length}`);
    
  } catch (error) {
    console.error('❌ Error en inicialización:', error);
  }
}

// ============================================
// USO EN CONSOLA DEL NAVEGADOR
// ============================================
// 1. Abre F12 (DevTools)
// 2. Ve a la pestaña "Console"
// 3. Copia este código (sin imports)
// 4. Ejecuta:
//    await inicializarFirestore(window.db);
//    (o usa la variable que tengas de tu instancia de Firestore)
