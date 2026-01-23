import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PedidosService, Pedido } from '../../service/pedidos/pedidos.service';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { EncomendistasService, Encomendista } from '../../service/encomendistas/encomendistas.service';
import { ModalNotificacionService } from '../../service/modal-notificacion/modal-notificacion.service';
import { ResponsiveService } from '../../service/responsive/responsive.service';
import { Subscription } from 'rxjs';

interface PedidoCompleto extends Pedido {
  cliente_nombre?: string;
  encomendista_nombre?: string;
}

interface PedidoPorFecha {
  fechaString: string; // YYYY-MM-DD - el identificador principal
  fecha: Date; // Solo para display, no para lógica
  fechaFormato: string;
  pedidos: PedidoCompleto[];
  cantidad: number;
  totalIngresos: number;
  totalEnvios: number;
}

interface CicloSemanal {
  ciclo: 'miercoles' | 'sabado';
  etiqueta: string;
  diasIncluidos: string; // "Mié, Jue, Vie" o "Sab, Dom, Lun, Mar"
  fechas: PedidoPorFecha[];
  cantidad: number;
  totalIngresos: number;
  totalEnvios: number;
}

@Component({
  selector: 'app-pedidos-por-fecha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pedidos-por-fecha.component.html',
  styleUrls: ['./pedidos-por-fecha.component.css']
})
export class PedidosPorFechaComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;
  pedidos: PedidoCompleto[] = [];
  clientes: Cliente[] = [];
  encomendistas: Encomendista[] = [];
  
  pedidosPorFecha: PedidoPorFecha[] = [];
  ciclos: CicloSemanal[] = [];
  cargando: boolean = false;
  filtroEstado: string = 'todos';
  filtroFechaInicio: string = '';
  filtroFechaFin: string = '';
  
  totalPedidos: number = 0;
  totalIngresos: number = 0;
  totalEnvios: number = 0;
  
  // Zoom
  imagenZoom: string | null = null;
  mostrarZoom = false;
  
  // Estados
  estadosList = ['pendiente', 'empacada', 'enviado', 'retirado', 'no-retirado', 'retirado-local', 'cancelado', 'liberado', 'remunero'];
  estadosVisibles = ['pendiente', 'empacada', 'enviado', 'retirado', 'no-retirado', 'retirado-local', 'cancelado', 'liberado', 'remunero'];

  private pedidosService = inject(PedidosService);
  private clientesService = inject(ClientesService);
  private encomendistasService = inject(EncomendistasService);
  private notificacionService = inject(ModalNotificacionService);
  private responsiveService = inject(ResponsiveService);
  private subscriptions: Subscription[] = [];

  ngOnInit() {
    // Detectar si es mobile
    const subResponsive = this.responsiveService.isMobile$.subscribe(isMobile => {
      this.isMobile = isMobile;
    });
    this.subscriptions.push(subResponsive);

    this.cargarDatos();

    // Fijar rango de fechas por defecto (últimos 30 días y próximos 30)
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const en30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    this.filtroFechaInicio = this.formatearFechaInput(hace30);
    this.filtroFechaFin = this.formatearFechaInput(en30);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Carga todos los datos necesarios
   */
  async cargarDatos() {
    this.cargando = true;
    try {
      // Cargar pedidos
      const subPedidos = this.pedidosService.cargarPedidos().subscribe((pedidos: Pedido[]) => {
        this.pedidos = pedidos as PedidoCompleto[];
        this.enriquecerPedidosYAgrupar();
      });
      this.subscriptions.push(subPedidos);

      // Cargar clientes
      const subClientes = this.clientesService.cargarClientes().subscribe((clientes: Cliente[]) => {
        this.clientes = clientes;
        this.enriquecerPedidosYAgrupar();
      });
      this.subscriptions.push(subClientes);

      // Cargar encomendistas
      const subEncomendistas = this.encomendistasService.cargarEncomendistas().subscribe((encomendistas: Encomendista[]) => {
        this.encomendistas = encomendistas;
        this.enriquecerPedidosYAgrupar();
      });
      this.subscriptions.push(subEncomendistas);

      this.cargando = false;
    } catch (error) {
      console.error('Error cargando datos:', error);
      this.notificacionService.mostrarError('Error al cargar datos');
      this.cargando = false;
    }
  }

  /**
   * Enriquece los pedidos con nombres de cliente y encomendista
   */
  enriquecerPedidosYAgrupar() {
    // Enriquecer pedidos
    this.pedidos = this.pedidos.map(pedido => ({
      ...pedido,
      cliente_nombre: this.clientes.find(c => c.id === pedido.cliente_id)?.nombre || 'Desconocido',
      encomendista_nombre: this.encomendistas.find(e => e.id === pedido.encomendista_id)?.nombre || 'Desconocido'
    }));

    // Agrupar por fecha
    this.agruparPorFecha();
  }

  /**
   * Agrupa los pedidos por ciclos semanales (Miércoles y Sábado)
   * IMPORTANTE: Trabaja directamente con STRING de fecha (YYYY-MM-DD)
   * Miércoles: Mié, Jue, Vie (días 3, 4, 5)
   * Sábado: Sab, Dom, Lun, Mar (días 6, 0, 1, 2)
   */
  agruparPorFecha() {
    // Primero, agrupar por fecha individual
    const agrupadoMap = new Map<string, PedidoCompleto[]>();

    console.log('\n=== INICIO EXTRACCIÓN DE FECHAS ===');
    console.log(`Total pedidos a procesar: ${this.pedidos.length}`);

    this.pedidos.forEach((pedido, idx) => {
      if (!pedido.fecha_entrega_programada) return;

      // EXTRAER SOLO LA FECHA STRING, sin tiempo ni zona horaria
      let fechaString: string;
      try {
        fechaString = this.extraerFechaString(pedido.fecha_entrega_programada);
      } catch {
        return;
      }

      // LOGGING: Mostrar TODOS los pedidos para debug (puedes filtrar en consola)
      // Mostrar especialmente los del domingo 18 y sábado 17
      const clientesAMostrar = ['Yamy Guevara', 'Vane Valladares', 'Lisseth Gomez', 'Helena R. A'];
      if (clientesAMostrar.includes(pedido.cliente_nombre || '')) {
        console.log(`\n🔍 PEDIDO [${idx}]:`);
        console.log(`   Cliente: ${pedido.cliente_nombre}`);
        console.log(`   fecha_entrega_programada (ORIGINAL): ${pedido.fecha_entrega_programada}`);
        console.log(`   Tipo: ${typeof pedido.fecha_entrega_programada}`);
        console.log(`   fechaString (EXTRAÍDO): ${fechaString}`);
        console.log(`   dia_entrega del pedido: ${pedido.dia_entrega}`);
        console.log(`   Código: ${pedido.codigo_pedido}`);
      }

      // Usar el string como clave principal
      if (!agrupadoMap.has(fechaString)) {
        agrupadoMap.set(fechaString, []);
      }
      agrupadoMap.get(fechaString)!.push(pedido);
    });

    console.log('\n=== FIN EXTRACCIÓN DE FECHAS ===\n');

    // Convertir a array de PedidoPorFecha
    this.pedidosPorFecha = Array.from(agrupadoMap)
      .map(([fechaString, pedidos]) => {
        // Solo convertir a Date PARA DISPLAY, no para lógica de agrupación
        const fecha = this.parsearFechaLocal(fechaString);
        // totalIngresos = total - monto_envio (el envío se paga aparte y regresa)
        const totalIngresos = pedidos.reduce((sum, p) => sum + ((p.total || 0) - (p.monto_envio || 0)), 0);
        const totalEnvios = pedidos.reduce((sum, p) => sum + (p.monto_envio || 0), 0);

        return {
          fechaString, // El identificador PRINCIPAL es el STRING
          fecha, // Solo para display
          fechaFormato: this.formatearFechaCompleta(fecha),
          pedidos,
          cantidad: pedidos.length,
          totalIngresos,
          totalEnvios
        };
      })
      .sort((a, b) => a.fechaString.localeCompare(b.fechaString)); // Comparar strings, no Dates

    // Agrupar por ciclos semanales
    this.agruparPorCiclos();

    // Calcular totales
    this.totalPedidos = this.pedidos.length;
    // totalIngresos = total - monto_envio (el envío se paga aparte y regresa)
    this.totalIngresos = this.pedidos.reduce((sum, p) => sum + ((p.total || 0) - (p.monto_envio || 0)), 0);
    this.totalEnvios = this.pedidos.reduce((sum, p) => sum + (p.monto_envio || 0), 0);

    this.aplicarFiltros();
  }

  /**
   * Resta días a una fecha STRING (YYYY-MM-DD)
   * @param fechaString Formato YYYY-MM-DD
   * @param dias Número de días a restar
   * @returns Nueva fecha como STRING en formato YYYY-MM-DD
   */
  private restarDiasAlString(fechaString: string, dias: number): string {
    const partes = fechaString.split('-');
    const año = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const día = parseInt(partes[2], 10);
    
    const fecha = new Date(año, mes, día);
    fecha.setDate(fecha.getDate() - dias);
    
    const nuevoAño = fecha.getFullYear();
    const nuevoMes = String(fecha.getMonth() + 1).padStart(2, '0');
    const nuevoDía = String(fecha.getDate()).padStart(2, '0');
    
    return `${nuevoAño}-${nuevoMes}-${nuevoDía}`;
  }

  /**
   * Extrae SOLO la fecha STRING (YYYY-MM-DD) del API, respetando la zona horaria original
   * Detecta el offset GMT del timestamp y lo usa para extraer la fecha correcta
   * Ejemplo: "Tue Jan 20 2026 23:33:34 GMT-0600" → detecta -0600 → retorna "2026-01-20"
   * @param fechaData Puede ser string, timestamp, Date, etc.
   * @returns String en formato YYYY-MM-DD en la zona horaria original
   */
  private extraerFechaString(fechaData: any): string {
    if (typeof fechaData === 'string') {
      // Si ya es string, tomar solo la parte de fecha
      if (fechaData.includes('T')) {
        return fechaData.split('T')[0]; // "2025-01-20T10:30:00" → "2025-01-20"
      }
      if (fechaData.includes(' ')) {
        // Formato: "Tue Jan 20 2026 23:33:34 GMT-0600"
        // Extraer el offset GMT
        const gmtMatch = fechaData.match(/GMT([+-]\d{2})(\d{2})/);
        if (gmtMatch) {
          const offsetHoras = parseInt(gmtMatch[1], 10);
          const offsetMinutos = parseInt(gmtMatch[2], 10);
          const offsetTotalMinutos = offsetHoras * 60 + (offsetHoras < 0 ? -offsetMinutos : offsetMinutos);
          
          // Parsear la fecha y ajustar por el offset
          const fecha = new Date(fechaData);
          fecha.setMinutes(fecha.getMinutes() - offsetTotalMinutos + fecha.getTimezoneOffset());
          
          const año = fecha.getFullYear();
          const mes = String(fecha.getMonth() + 1).padStart(2, '0');
          const día = String(fecha.getDate()).padStart(2, '0');
          return `${año}-${mes}-${día}`;
        }
        // Fallback si no tiene GMT
        return fechaData.split(' ')[0];
      }
      // Ya es YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(fechaData)) {
        return fechaData;
      }
    }
    
    if (typeof fechaData === 'object' && fechaData !== null) {
      // Es un Date o timestamp Firestore
      let fecha: Date;
      let offsetTotalMinutos = 0;
      
      if (fechaData.toDate instanceof Function) {
        // Es un Timestamp de Firestore - convertir a string para extraer offset
        const fechaStr = fechaData.toDate().toString();
        const gmtMatch = fechaStr.match(/GMT([+-]\d{2})(\d{2})/);
        if (gmtMatch) {
          const offsetHoras = parseInt(gmtMatch[1], 10);
          const offsetMinutos = parseInt(gmtMatch[2], 10);
          offsetTotalMinutos = offsetHoras * 60 + (offsetHoras < 0 ? -offsetMinutos : offsetMinutos);
        }
        fecha = fechaData.toDate();
      } else if (fechaData instanceof Date) {
        fecha = fechaData;
      } else {
        fecha = new Date(fechaData);
      }
      
      // Ajustar por el offset detectado
      fecha.setMinutes(fecha.getMinutes() - offsetTotalMinutos + fecha.getTimezoneOffset());
      
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const día = String(fecha.getDate()).padStart(2, '0');
      return `${año}-${mes}-${día}`;
    }
    
    throw new Error(`No se puede extraer fecha de: ${fechaData}`);
  }

  /**
   * Convierte string de fecha a Date respetando zona horaria local
   * @param fechaString Formato YYYY-MM-DD
   * @returns Date a las 00:00:00 en zona local
   */
  private parsearFechaLocal(fechaString: string | Date): Date {
    if (fechaString instanceof Date) return fechaString;
    
    const partes = fechaString.split('-');
    if (partes.length !== 3) return new Date();
    
    const año = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1; // getMonth es 0-indexed
    const día = parseInt(partes[2], 10);
    
    return new Date(año, mes, día); // Esto usa zona local
  }

  /**
   * Agrupa los pedidos por ciclos semanales
   * Miércoles: Mié (3), Jue (4), Vie (5) - SOLO estos días
   * Sábado: Sab (6), Dom (0), Lun (1), Mar (2) - SOLO estos días
   * 
   * ESTRATEGIA: Usa STRING de fecha como identificador principal,
   * solo convierte a Date para calcular día de semana
   */
  agruparPorCiclos() {
    this.ciclos = [];

    if (this.pedidosPorFecha.length === 0) return;

    // Map para agrupar por ciclo, usando STRINGS como claves
    const ciclosMap = new Map<string, { tipo: 'miercoles' | 'sabado'; fechaInicioString: string; fechas: PedidoPorFecha[] }>();

    // LOGGING: Información de inicio
    console.log('=== INICIO AGRUPACIÓN POR CICLOS ===');
    console.log(`Total fechas de pedidos a procesar: ${this.pedidosPorFecha.length}`);
    console.log(`Hoy es: ${new Date().toLocaleDateString('es-SV', { year: 'numeric', month: '2-digit', day: '2-digit' })}, día ${new Date().getDay()}`);

    // Procesar cada fecha de pedido y asignarla al ciclo correcto
    this.pedidosPorFecha.forEach((pedidoFecha, idx) => {
      // Convertir STRING a Date SOLO para calcular día de semana
      const fechaDate = this.parsearFechaLocal(pedidoFecha.fechaString);
      const diaSemana = fechaDate.getDay(); // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sab
      const nombreDia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      let tipo: 'miercoles' | 'sabado';
      let fechaInicioString: string;

      // MIÉRCOLES: día 3 (Mié), 4 (Jue), 5 (Vie)
      if (diaSemana === 3 || diaSemana === 4 || diaSemana === 5) {
        tipo = 'miercoles';
        // Calcular cuántos días atrás está el Miércoles (día 3) - USANDO STRINGS
        const diasAlMiercoles = diaSemana - 3;
        fechaInicioString = this.restarDiasAlString(pedidoFecha.fechaString, diasAlMiercoles);
        
        console.log(`[${idx}] ${pedidoFecha.fechaFormato} (Día: ${diaSemana} - ${nombreDia[diaSemana]}) → CICLO MIÉRCOLES, diasAlMiercoles: ${diasAlMiercoles}, fechaInicio: ${fechaInicioString}`);
        
        // Detallar cada pedido en esta fecha
        pedidoFecha.pedidos.forEach(pedido => {
          console.log(`    • ${pedido.codigo_pedido} - ${pedido.cliente_nombre} (hora: ${pedido.hora_inicio}-${pedido.hora_fin})`);
        });
      } 
      // SÁBADO: día 6 (Sab), 0 (Dom), 1 (Lun), 2 (Mar)
      else {
        tipo = 'sabado';
        let diasAlSabado: number;
        if (diaSemana === 6) {
          diasAlSabado = 0; // Es Sábado, no restar nada
        } else if (diaSemana === 0) {
          diasAlSabado = 1; // Es Domingo, restar 1 día
        } else if (diaSemana === 1) {
          diasAlSabado = 2; // Es Lunes, restar 2 días
        } else {
          // diaSemana === 2, Es Martes, restar 3 días
          diasAlSabado = 3;
        }
        
        fechaInicioString = this.restarDiasAlString(pedidoFecha.fechaString, diasAlSabado);
        
        console.log(`[${idx}] ${pedidoFecha.fechaFormato} (Día: ${diaSemana} - ${nombreDia[diaSemana]}) → CICLO SÁBADO, diasAlSabado: ${diasAlSabado}, fechaInicio: ${fechaInicioString}`);
        
        // Detallar cada pedido en esta fecha
        pedidoFecha.pedidos.forEach(pedido => {
          console.log(`    • ${pedido.codigo_pedido} - ${pedido.cliente_nombre} (hora: ${pedido.hora_inicio}-${pedido.hora_fin})`);
        });
      }

      // Clave del ciclo usando STRINGS, no Dates
      const cicloKey = `${tipo}-${fechaInicioString}`;
      console.log(`    cicloKey: "${cicloKey}", pedidos en esta fecha: ${pedidoFecha.cantidad}`);

      if (!ciclosMap.has(cicloKey)) {
        ciclosMap.set(cicloKey, {
          tipo,
          fechaInicioString,
          fechas: []
        });
      }

      ciclosMap.get(cicloKey)!.fechas.push(pedidoFecha);
    });

    console.log(`\n=== CICLOS MAPEADOS (${ciclosMap.size}) ===`);
    ciclosMap.forEach((cicloData, cicloKey) => {
      const totalPedidos = cicloData.fechas.reduce((sum, pf) => sum + pf.cantidad, 0);
      const fechasIncluidas = cicloData.fechas.map(pf => pf.fechaFormato).join(' | ');
      console.log(`${cicloKey}: ${totalPedidos} pedidos en fechas: ${fechasIncluidas}`);
    });

    // Convertir map a array y crear ciclos, ordenado por fecha de inicio (STRING)
    const ciclosArray = Array.from(ciclosMap.values())
      .sort((a, b) => a.fechaInicioString.localeCompare(b.fechaInicioString)); // Comparar strings

    // Crear ciclos con numeración independiente por tipo
    ciclosArray.forEach((cicloData, index) => {
      const totalIngresos = cicloData.fechas.reduce((sum, pf) => sum + pf.totalIngresos, 0);
      const totalEnvios = cicloData.fechas.reduce((sum, pf) => sum + pf.totalEnvios, 0);
      const cantidad = cicloData.fechas.reduce((sum, pf) => sum + pf.cantidad, 0);

      const diasLabel = cicloData.tipo === 'miercoles' 
        ? 'Miércoles, Jueves, Viernes'
        : 'Sábado, Domingo, Lunes, Martes';

      // Contar cuántos ciclos del mismo tipo hay antes de este
      const ciclosDelMismoTipoAntes = ciclosArray.slice(0, index)
        .filter(c => c.tipo === cicloData.tipo).length;
      
      const weekNum = ciclosDelMismoTipoAntes + 1;

      const etiqueta = cicloData.tipo === 'miercoles' 
        ? `📅 SEMANA ${weekNum} - MIÉRCOLES`
        : `📅 SEMANA ${weekNum} - SÁBADO`;

      // Ordenar fechas por STRING, no por Date
      const fechasOrdenadas = cicloData.fechas.sort((a, b) => a.fechaString.localeCompare(b.fechaString));
      
      console.log(`\nCICLO ${weekNum} (${cicloData.tipo.toUpperCase()}):`);
      console.log(`  Rango esperado: ${diasLabel}`);
      console.log(`  Fechas reales incluidas: ${fechasOrdenadas.map(f => f.fechaFormato).join(' | ')}`);
      console.log(`  Total pedidos: ${cantidad}`);

      this.ciclos.push({
        ciclo: cicloData.tipo,
        etiqueta,
        diasIncluidos: diasLabel,
        fechas: fechasOrdenadas,
        cantidad,
        totalIngresos,
        totalEnvios
      });
      
      // LOGGING DETALLADO: Mostrar cada fecha y sus pedidos en este ciclo
      console.log(`\n  === DETALLES CICLO ${weekNum} ===`);
      fechasOrdenadas.forEach(pedidoFecha => {
        console.log(`\n  📆 ${pedidoFecha.fechaFormato} (${['Dom','Lun','Mar','Mié','Jue','Vie','Sab'][pedidoFecha.fecha.getDay()]}):`);
        pedidoFecha.pedidos.forEach(pedido => {
          console.log(`     - ${pedido.codigo_pedido} | ${pedido.cliente_nombre} | ${pedido.dia_entrega} | Hora: ${pedido.hora_inicio}-${pedido.hora_fin}`);
        });
      });
    });
    
    console.log('\n=== FIN AGRUPACIÓN ===');
    console.log(`Total ciclos generados: ${this.ciclos.length}`);
    console.log(`CICLOS GENERADOS FINALES:`);
    this.ciclos.forEach(ciclo => {
      console.log(`  - ${ciclo.etiqueta} (${ciclo.cantidad} pedidos)`);
    });
    console.log('==========================================\n');
  }

  /**
   * Aplica filtros de estado y rango de fechas a los ciclos
   * IMPORTANTE: El filtro de fechas selecciona ciclos COMPLETOS basándose en el rango
   * Ejemplo: Si filtras Sábado 10 a Martes 13, muestra el ciclo SÁBADO completo (10-13)
   */
  aplicarFiltros() {
    let ciclosFiltered = this.ciclos;

    // Filtrar por rango de fechas: Mostrar ciclos COMPLETOS que caigan en el rango
    if (this.filtroFechaInicio && this.filtroFechaFin) {
      const inicio = new Date(this.filtroFechaInicio);
      const fin = new Date(this.filtroFechaFin);
      
      const inicioKey = inicio.toISOString().split('T')[0];
      const finKey = fin.toISOString().split('T')[0];

      // Encontrar a qué ciclos pertenecen las fechas de inicio y fin
      const cicloInicio = this.encontrarCicloPorFecha(inicioKey);
      const cicloFin = this.encontrarCicloPorFecha(finKey);

      // Si encontramos ciclos, mostrar desde el ciclo de inicio hasta el ciclo de fin
      if (cicloInicio !== null && cicloFin !== null) {
        ciclosFiltered = this.ciclos.slice(cicloInicio, cicloFin + 1);
      }
    }

    // Aplicar filtro de estado a los pedidos dentro de los ciclos seleccionados
    if (this.filtroEstado !== 'todos') {
      ciclosFiltered = ciclosFiltered.map(ciclo => {
        const fechasFiltered = ciclo.fechas.map(pf => ({
          ...pf,
          pedidos: pf.pedidos.filter(p => p.estado === this.filtroEstado),
          cantidad: pf.pedidos.filter(p => p.estado === this.filtroEstado).length,
          // totalIngresos = total - envío (envío se paga aparte y regresa)
          totalIngresos: pf.pedidos
            .filter(p => p.estado === this.filtroEstado)
            .reduce((sum, p) => sum + ((p.total || 0) - (p.monto_envio || 0)), 0),
          totalEnvios: pf.pedidos
            .filter(p => p.estado === this.filtroEstado)
            .reduce((sum, p) => sum + (p.monto_envio || 0), 0)
        })).filter(pf => pf.cantidad > 0);

        // Calcular totales del ciclo
        const cantidad = fechasFiltered.reduce((sum, pf) => sum + pf.cantidad, 0);
        const totalIngresos = fechasFiltered.reduce((sum, pf) => sum + pf.totalIngresos, 0);
        const totalEnvios = fechasFiltered.reduce((sum, pf) => sum + pf.totalEnvios, 0);

        return {
          ...ciclo,
          fechas: fechasFiltered,
          cantidad,
          totalIngresos,
          totalEnvios
        };
      }).filter(ciclo => ciclo.cantidad > 0);
    }

    this.ciclos = ciclosFiltered;
  }

  /**
   * Encuentra el índice del ciclo que contiene una fecha específica
   * @param fechaKey Fecha en formato YYYY-MM-DD
   * @returns Índice del ciclo o null si no se encuentra
   */
  private encontrarCicloPorFecha(fechaKey: string): number | null {
    for (let i = 0; i < this.ciclos.length; i++) {
      const ciclo = this.ciclos[i];
      // Verificar si esta fecha existe en alguna de las fechas del ciclo (COMPARAR STRINGS)
      const existeEnCiclo = ciclo.fechas.some(pf => pf.fechaString === fechaKey);

      if (existeEnCiclo) {
        return i;
      }
    }
    return null;
  }

  /**
   * Formatea una fecha para input HTML (YYYY-MM-DD)
   */
  private formatearFechaInput(fecha: Date): string {
    const año = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const día = String(fecha.getDate()).padStart(2, '0');
    return `${año}-${mes}-${día}`;
  }

  /**
   * Formatea fecha como "Viernes 24 de Enero 2025"
   */
  formatearFechaCompleta(fecha: Date): string {
    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const días = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    const día = fecha.getDate();
    const mes = meses[fecha.getMonth()];
    const año = fecha.getFullYear();
    const diaSemana = días[fecha.getDay()];

    return `${diaSemana} ${día} de ${mes} ${año}`;
  }

  /**
   * Abre zoom de imagen
   */
  abrirZoom(url: string) {
    this.imagenZoom = url;
    this.mostrarZoom = true;
  }

  /**
   * Cierra zoom de imagen
   */
  cerrarZoom() {
    this.mostrarZoom = false;
    this.imagenZoom = null;
  }

  /**
   * Obtiene color de badge según estado
   */
  obtenerColorEstado(estado: string): string {
    const colores: { [key: string]: string } = {
      'pendiente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'empacada': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'enviado': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'retirado': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'no-retirado': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'retirado-local': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      'cancelado': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
      'liberado': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
      'remunero': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    };
    return colores[estado] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Obtiene emoji según estado
   */
  obtenerEmojiEstado(estado: string): string {
    const emojis: { [key: string]: string } = {
      'pendiente': '⏳',
      'empacada': '📦',
      'enviado': '🚚',
      'retirado': '✅',
      'no-retirado': '❌',
      'retirado-local': '🏪',
      'cancelado': '🚫',
      'liberado': '🎉',
      'remunero': '💰'
    };
    return emojis[estado] || '📋';
  }

  /**
   * Formatea fecha de entrega programada desde string
   */
  formatearFechaEntrega(fechaString: string | Date | undefined): string {
    try {
      if (!fechaString) return '-';
      const fecha = typeof fechaString === 'string' ? new Date(fechaString) : fechaString;
      return this.formatearFechaCompleta(fecha);
    } catch {
      return '-';
    }
  }
}
