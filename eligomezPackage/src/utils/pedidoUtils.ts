/**
 * Normaliza texto: quita acentos y convierte a minúsculas
 * "José María" → "jose maria"
 * "Córdoba" → "cordoba"
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Genera un código de pedido único basado en la tienda y el día
 * Formato: INICIALES + YYYYMMDD + SECUENCIA (3 dígitos)
 * Ejemplo: "EG20260109001" para "Eli Gomez" del 9 de enero 2026, primer pedido
 * 
 * CRÍTICO: Este código NUNCA debe repetirse. Se valida contra todos los pedidos del día.
 * 
 * @param tiendaNombre - Nombre de la tienda (ej: "Eli Gomez")
 * @param pedidosDelDia - Array de pedidos existentes del día actual
 * @returns Código generado (ej: "EG20260109001")
 */
export function generarCodigoPedido(tiendaNombre: string = 'XX', pedidosDelDia: any[] = []): string {
  console.log('\n%c═══════════════════════════════════════', 'color: blue; font-weight: bold');
  console.log('%c🔢 GENERANDO CÓDIGO DE PEDIDO', 'color: blue; font-weight: bold; font-size: 14px');
  console.log('%c═══════════════════════════════════════', 'color: blue; font-weight: bold');
  
  // Obtener iniciales de la tienda (máximo 2 caracteres)
  // "Eli Gomez" → "EG"
  const iniciales = tiendaNombre
    .split(' ')
    .map(palabra => palabra[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  // Obtener fecha actual en formato YYYYMMDD
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  const prefijo = `${iniciales}${año}${mes}${dia}`;
  const prefijoLength = prefijo.length; // Siempre 10 caracteres

  console.log(`📍 Tienda: ${tiendaNombre}`);
  console.log(`🔤 Iniciales: ${iniciales}`);
  console.log(`📅 Fecha: ${hoy.toLocaleDateString()}`);
  console.log(`🔐 Prefijo: "${prefijo}" (longitud: ${prefijoLength})`);
  console.log(`📦 Total pedidos recibidos para análisis: ${pedidosDelDia.length}`);
  
  if (!pedidosDelDia || pedidosDelDia.length === 0) {
    console.log(`⚠️  No hay pedidos previos del día. Iniciando con secuencia 001`);
    const codigo = `${prefijo}001`;
    console.log(`✅ CÓDIGO GENERADO: ${codigo} (PRIMER PEDIDO DEL DÍA)`);
    console.log('%c═══════════════════════════════════════\n', 'color: blue; font-weight: bold');
    return codigo;
  }

  // Filtrar pedidos de hoy con el mismo prefijo y extraer números de secuencia
  const codigosValidos: number[] = [];
  
  pedidosDelDia.forEach((pedido, index) => {
    const codigo = pedido.codigo_pedido?.toString() || '';
    console.log(`\n  📋 Pedido ${index + 1}: ${codigo}`);
    
    if (codigo.startsWith(prefijo)) {
      console.log(`     ✓ Prefijo coincide con "${prefijo}"`);
      const secuenciaStr = codigo.substring(prefijoLength);
      const secuencia = parseInt(secuenciaStr, 10);
      console.log(`     → Secuencia extraída: "${secuenciaStr}" = ${secuencia}`);
      
      if (!isNaN(secuencia) && secuencia > 0) {
        codigosValidos.push(secuencia);
        console.log(`     ✓ Válido, agregado a lista`);
      } else {
        console.log(`     ✗ Inválido (no es número o es 0)`);
      }
    } else {
      console.log(`     ✗ Prefijo NO coincide (esperado: "${prefijo}", encontrado: "${codigo.substring(0, 10)}")`);
    }
  });

  console.log(`\n🔍 Secuencias válidas encontradas: ${JSON.stringify(codigosValidos)}`);
  
  // Ordenar de mayor a menor para obtener el máximo
  codigosValidos.sort((a, b) => b - a);
  console.log(`🔝 Ordenadas descendentemente: ${JSON.stringify(codigosValidos)}`);

  // El siguiente número es el máximo + 1
  const maxSecuencia = codigosValidos[0] || 0;
  const proximoNumero = maxSecuencia + 1;
  
  console.log(`\n📊 Máxima secuencia encontrada: ${maxSecuencia}`);
  console.log(`➕ Siguiente secuencia: ${proximoNumero}`);
  
  const codigo = `${prefijo}${String(proximoNumero).padStart(3, '0')}`;

  console.log(`\n✅ CÓDIGO FINAL GENERADO: "${codigo}"`);
  console.log('%c═══════════════════════════════════════\n', 'color: blue; font-weight: bold');
  
  return codigo;
}

/**
 * Formatea una fecha como "Jueves 24 de Diciembre 2025"
 */
export function formatearFecha(fecha: Date): string {
  const diasSemana = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  
  const mesesNombres = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];

  const día = fecha.getDate();
  const mes = mesesNombres[fecha.getMonth()];
  const año = fecha.getFullYear();
  const diaSemana = diasSemana[fecha.getDay()];

  return `${diaSemana} ${día} de ${mes} ${año}`;
}

/**
 * Calcula las próximas N fechas de un día específico con offset
 */
export function calcularProximasFechas(
  nombreDia: string,
  cantidad: number = 4,
  offset: number = 0
): { fecha: Date; fechaFormato: string }[] {
  const diasSemana = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  
  const diaIndice = diasSemana.indexOf(nombreDia);
  if (diaIndice === -1) return [];

  const fechas: { fecha: Date; fechaFormato: string }[] = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let fecha = new Date(hoy);
  const diaActual = fecha.getDay(); // 0=Domingo, 1=Lunes, etc.

  // Calcular días faltantes hasta el día seleccionado
  let diasAdelante = diaIndice - diaActual;

  // Si el resultado es 0 o negativo (día ya pasó esta semana), ir al próximo
  if (diasAdelante <= 0) {
    diasAdelante += 7;
  }

  fecha.setDate(fecha.getDate() + diasAdelante);

  // Agregar offset de semanas
  fecha.setDate(fecha.getDate() + offset * 7);

  for (let i = 0; i < cantidad; i++) {
    const fechaFormato = formatearFecha(fecha);
    fechas.push({
      fecha: new Date(fecha),
      fechaFormato: fechaFormato,
    });
    fecha.setDate(fecha.getDate() + 7); // Sumar 7 días para la próxima ocurrencia
  }

  return fechas;
}
