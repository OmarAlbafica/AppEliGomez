import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, interval, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PedidosService, Pedido } from '../../service/pedidos/pedidos.service';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { EncomendistasService, Encomendista } from '../../service/encomendistas/encomendistas.service';
import { ResponsiveService } from '../../service/responsive/responsive.service';

interface DashboardStats {
  pedidosHoy: number;
  pedidosTomorrow: number;
  pedidosMiercoles: number;
  pedidosSabado: number;
  pedidosNoRetirados: number;
  ingresoHoy: number;
  ingresoMes: number;
  ingresoMiercoles: number;
  ingresoSabado: number;
  tasaEntrega: number;
}

interface RetiroItem {
  id: string;
  destino: string;
  encomendista: string;
  hora: string;
  horainicio: string;
  horafin: string;
  cantidad: number;
  pedidos: any[];
  expanded?: boolean;
}

interface PedidoPendiente {
  id: string;
  cliente: string;
  destino: string;
  horaInicio: string;
  horaFin: string;
  estado: 'pasado' | 'en-progreso' | 'pendiente';
  monto: number;
}

interface Remuneracion {
  fecha: Date;
  tipo: 'miercoles' | 'sabado';
  fechasIncluidas: string;
  pedidos: {
    id: string;
    cliente: string;
    destino: string;
    encomendista?: string;
    estado: string;
    montoEnvio: number;
    montoTotal: number;
    montoSinEnvio: number;
    fechaEntrega: Date;
    fechaEntregaFormato?: string;
  }[];
  totalSinEnvio: number;
  totalEnvios: number;
  totalGeneral: number;
  // Separados por estado
  remunerados: any[];
  cancelados: any[];
  enviados: any[];
  subtotalesRemunerado: { totalEnvios: number; totalSinEnvio: number; totalGeneral: number };
  subtotalesCancelado: { totalEnvios: number; totalSinEnvio: number; totalGeneral: number };
  subtotalesEnviado: { totalEnvios: number; totalSinEnvio: number; totalGeneral: number };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;
  stats: DashboardStats = {
    pedidosHoy: 0,
    pedidosTomorrow: 0,
    pedidosMiercoles: 0,
    pedidosSabado: 0,
    pedidosNoRetirados: 0,
    ingresoHoy: 0,
    ingresoMes: 0,
    ingresoMiercoles: 0,
    ingresoSabado: 0,
    tasaEntrega: 0
  };

  retiroHoy: RetiroItem[] = [];
  retiroTomorrow: RetiroItem[] = [];
  pedidosNoRetirados: PedidoPendiente[] = [];
  remuneraciones: Remuneracion[] = [];
  reporteActual: 'miercoles' | 'sabado' = 'miercoles';

  private destroy$ = new Subject<void>();
  private subscriptions: Subscription[] = [];
  private pedidos: Pedido[] = [];
  private clientes: Cliente[] = [];
  private encomendistas: Encomendista[] = [];

  constructor(
    private pedidosService: PedidosService,
    private clientesService: ClientesService,
    private encomendistasService: EncomendistasService,
    private responsiveService: ResponsiveService
  ) {}

  ngOnInit() {
    this.isMobile = this.responsiveService.getIsMobile();
    this.responsiveService.isMobile$.subscribe(val => this.isMobile = val);
    // Cargar datos iniciales
    this.cargarDatosIniciales();

    // Auto-refresh cada 30 segundos
    interval(30000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.cargarDatos();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private cargarDatosIniciales() {
    // Cargar todos los datos en paralelo
    const pedidosSub = this.pedidosService.cargarPedidos().subscribe((pedidos: Pedido[]) => {
      this.pedidos = pedidos;
      this.verificarYCalcular();
    });
    this.subscriptions.push(pedidosSub);

    const clientesSub = this.clientesService.cargarClientes().subscribe((clientes: Cliente[]) => {
      this.clientes = clientes;
      this.verificarYCalcular();
    });
    this.subscriptions.push(clientesSub);

    const encomendistaSub = this.encomendistasService.cargarEncomendistas().subscribe((encomendistas: Encomendista[]) => {
      this.encomendistas = encomendistas;
      this.verificarYCalcular();
    });
    this.subscriptions.push(encomendistaSub);
  }

  private verificarYCalcular() {
    // Calcular solo cuando TODOS los datos estén listos
    if (this.pedidos.length > 0 && this.clientes.length > 0 && this.encomendistas.length > 0) {
      this.calcularEstadisticas();
    }
  }

  cargarDatos() {
    this.cargarDatosIniciales();
  }

  private calcularEstadisticas() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    // Contar pedidos de hoy y mañana
    this.stats.pedidosHoy = this.pedidos.filter(p => {
      const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      return fecha.getTime() === hoy.getTime() && !['cancelado', 'retirado-local'].includes(p.estado);
    }).length;

    this.stats.pedidosTomorrow = this.pedidos.filter(p => {
      const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      return fecha.getTime() === manana.getTime() && !['cancelado', 'retirado-local'].includes(p.estado);
    }).length;

    // Pedidos para miércoles y sábado
    const proximoMiercoles = this.calcularProximoMiercoles();
    const proximoSabado = this.calcularProximoSabado();

    this.stats.pedidosMiercoles = this.pedidos.filter(p => {
      const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      return this.esEntreFechas(fecha, proximoMiercoles, true) && !['cancelado', 'retirado-local'].includes(p.estado);
    }).length;

    this.stats.pedidosSabado = this.pedidos.filter(p => {
      const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      return this.esEntreFechas(fecha, proximoSabado, true) && !['cancelado', 'retirado-local'].includes(p.estado);
    }).length;

    // Ingresos
    this.stats.ingresoHoy = this.pedidos
      .filter(p => {
        const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
        return fecha.getTime() === hoy.getTime();
      })
      .reduce((sum, p) => sum + (p.total || 0), 0);

    this.stats.ingresoMes = this.pedidos
      .filter(p => {
        const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
        return fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth();
      })
      .reduce((sum, p) => sum + (p.total || 0), 0);

    this.stats.ingresoMiercoles = this.pedidos
      .filter(p => {
        const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
        return this.esEntreFechas(fecha, proximoMiercoles, true);
      })
      .reduce((sum, p) => sum + (p.total || 0), 0);

    this.stats.ingresoSabado = this.pedidos
      .filter(p => {
        const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
        return this.esEntreFechas(fecha, proximoSabado, true);
      })
      .reduce((sum, p) => sum + (p.total || 0), 0);

    // Tasa de entrega (% de pedidos entregados)
    const totalPedidos = this.pedidos.length;
    const pedidosEntregados = this.pedidos.filter(p => ['liberado', 'retirado', 'retirado-local'].includes(p.estado)).length;
    this.stats.tasaEntrega = totalPedidos > 0 ? Math.round((pedidosEntregados / totalPedidos) * 100) : 0;

    // Pedidos no retirados
    this.stats.pedidosNoRetirados = this.pedidos.filter(p => p.estado === 'no-retirado').length;

    this.construirRetiros();
    this.construirPendientes();
    this.calcularRemuneraciones();
  }

  private construirRetiros() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const retirosHoyMap = new Map<string, RetiroItem>();
    const retirosMañanaMap = new Map<string, RetiroItem>();

    this.pedidos
      .filter(p => !['cancelado', 'liberado', 'retirado-local'].includes(p.estado))
      .forEach(pedido => {
        const fechaEntrega = this.obtenerFechaEntrega(pedido.fecha_entrega_programada);
        fechaEntrega.setHours(0, 0, 0, 0);

        // Solo incluir si es hoy o mañana
        if (fechaEntrega.getTime() !== hoy.getTime() && fechaEntrega.getTime() !== manana.getTime()) {
          return;
        }

        const key = `${pedido.encomendista_id || 'otros'}-${pedido.destino_id || 'personalizado'}`;
        const isHoy = fechaEntrega.getTime() === hoy.getTime();
        const retirosMap = isHoy ? retirosHoyMap : retirosMañanaMap;

        if (!retirosMap.has(key)) {
          const encomendista = this.encomendistas.find(e => e.id === pedido.encomendista_id);
          const horaInicio = pedido.hora_inicio || '09:00';
          const horaFin = pedido.hora_fin || '18:00';
          
          retirosMap.set(key, {
            id: key,
            destino: pedido.destino_id || 'Personalizado',
            encomendista: encomendista?.nombre || 'Sin asignar',
            hora: `${this.convertirA12Horas(horaInicio)} - ${this.convertirA12Horas(horaFin)}`,
            horainicio: horaInicio,
            horafin: horaFin,
            cantidad: 0,
            pedidos: [],
            expanded: false
          });
        }

        const retiro = retirosMap.get(key)!;
        retiro.cantidad += 1;
        retiro.pedidos.push({
          id: pedido.codigo_pedido || pedido.id,
          cliente: this.obtenerNombreCliente(pedido.cliente_id),
          items: pedido.cantidad_prendas,
          monto: pedido.total,
          estado: pedido.estado
        });
      });

    this.retiroHoy = Array.from(retirosHoyMap.values());
    this.retiroTomorrow = Array.from(retirosMañanaMap.values());
  }

  private construirPendientes() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Mostrar los MISMOS pedidos que en Retiros de Hoy, pero agrupados por pedido individual
    this.pedidosNoRetirados = this.pedidos
      .filter(p => {
        const fechaEntrega = this.obtenerFechaEntrega(p.fecha_entrega_programada);
        fechaEntrega.setHours(0, 0, 0, 0);
        // Solo pedidos que se entregan hoy y NO están cancelados, liberados o retirados localmente
        return !['cancelado', 'liberado', 'retirado-local'].includes(p.estado) && fechaEntrega.getTime() === hoy.getTime();
      })
      .map(p => {
        const horaInicio = p.hora_inicio || '09:00';
        const horaFin = p.hora_fin || '18:00';
        const estado = this.calcularEstadoPendiente(horaInicio, horaFin);

        return {
          id: p.codigo_pedido || p.id,
          cliente: this.obtenerNombreCliente(p.cliente_id),
          destino: p.destino_id || 'Personalizado',
          horaInicio: this.convertirA12Horas(horaInicio),
          horaFin: this.convertirA12Horas(horaFin),
          estado: estado,
          monto: p.total || 0
        };
      })
      .sort((a, b) => {
        // Ordenar: En Progreso primero, luego Pendiente, luego Pasado
        const orden = { 'en-progreso': 0, 'pendiente': 1, 'pasado': 2 };
        return (orden[a.estado] || 3) - (orden[b.estado] || 3);
      })
      .slice(0, 5);
  }

  private obtenerFechaEntrega(fecha: any): Date {
    if (!fecha) return new Date();
    
    // ✅ SI es string YYYY-MM-DD, parsearlo correctamente sin timezone issues
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const [year, month, day] = fecha.split('-').map(Number);
      // Crear fecha en zona horaria LOCAL (no UTC)
      return new Date(year, month - 1, day);
    }
    
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') return new Date(fecha);
    if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate();
    return new Date(fecha);
  }

  private calcularProximoMiercoles(): Date {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diasParaMiercoles = (3 - diaSemana + 7) % 7 || 7;
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + diasParaMiercoles);
    return fecha;
  }

  private calcularProximoSabado(): Date {
    const hoy = new Date();
    const diaSemana = hoy.getDay();
    const diasParaSabado = (6 - diaSemana + 7) % 7 || 7;
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + diasParaSabado);
    return fecha;
  }

  private esEntreFechas(fecha: Date, referencia: Date, mismoDay: boolean = false): boolean {
    if (mismoDay) {
      return fecha.toDateString() === referencia.toDateString();
    }
    return fecha.getTime() >= referencia.getTime();
  }

  private calcularDiasSinRetirar(fechaEntrega: any): number {
    const fecha = this.obtenerFechaEntrega(fechaEntrega);
    const hoy = new Date();
    const diferencia = hoy.getTime() - fecha.getTime();
    return Math.floor(diferencia / (1000 * 3600 * 24));
  }

  /**
   * Convierte hora formato 24h a formato 12h
   * Ejemplo: "09:00" -> "9:00 AM", "14:30" -> "2:30 PM"
   */
  private convertirA12Horas(hora24: string): string {
    try {
      const [horas, minutos] = hora24.split(':');
      const h = parseInt(horas, 10);
      const m = parseInt(minutos || '0', 10);
      
      const periodo = h >= 12 ? 'PM' : 'AM';
      const horaFormato = h === 0 ? 12 : h > 12 ? h - 12 : h;
      
      return `${horaFormato}:${String(m).padStart(2, '0')} ${periodo}`;
    } catch {
      return hora24;
    }
  }

  /**
   * Calcula el estado del pedido basado en la hora actual y el horario de entrega
   * Retorna: 'pasado' | 'en-progreso' | 'pendiente'
   */
  private calcularEstadoPendiente(horaInicio: string, horaFin: string): 'pasado' | 'en-progreso' | 'pendiente' {
    try {
      const ahora = new Date();
      const horaActual = ahora.getHours() * 60 + ahora.getMinutes(); // En minutos

      const [horasI, minutosI] = horaInicio.split(':');
      const horaInicioMin = parseInt(horasI, 10) * 60 + parseInt(minutosI || '0', 10);

      const [horasF, minutosF] = horaFin.split(':');
      const horaFinMin = parseInt(horasF, 10) * 60 + parseInt(minutosF || '0', 10);

      if (horaActual < horaInicioMin) {
        return 'pendiente';
      } else if (horaActual >= horaInicioMin && horaActual <= horaFinMin) {
        return 'en-progreso';
      } else {
        return 'pasado';
      }
    } catch {
      return 'pendiente';
    }
  }

  private calcularRemuneraciones() {
    const hoy = new Date();
    const diaHoy = hoy.getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
    hoy.setHours(0, 0, 0, 0);
    
    console.log('=== CALCULAR REMUNERACIONES ===');
    console.log('Hoy:', hoy, 'Día de semana:', diaHoy);
    console.log('Total pedidos disponibles:', this.pedidos.length);
    
    this.remuneraciones = [];

    if (diaHoy === 3) {
      // HOY ES MIÉRCOLES
      // Mostrar: Sab-Dom-Lun-Mar (4 días hasta hoy inclusive)
      const inicioMiercoles = new Date(hoy);
      inicioMiercoles.setDate(inicioMiercoles.getDate() - 4);
      
      console.log('HOY ES MIÉRCOLES - Reporte MIÉRCOLES:', inicioMiercoles, 'a', hoy);
      
      const reporteMiercoles = this.filtrarPorDiasEspecificos(
        inicioMiercoles,
        hoy,
        'miercoles',
        [6, 0, 1, 2],
        'Sab-Dom-Lun-Mar'
      );
      console.log('Reporte Miércoles resultado:', reporteMiercoles);
      if (reporteMiercoles) {
        this.remuneraciones.push(reporteMiercoles);
      }

      // REPORTE SÁBADO: 3 días antes del ÚLTIMO SÁBADO (hace 4 días)
      const ultimoSabado = new Date(hoy);
      ultimoSabado.setDate(ultimoSabado.getDate() - 4); // Sábado anterior
      const inicioSabado = new Date(ultimoSabado);
      inicioSabado.setDate(inicioSabado.getDate() - 3); // 3 días antes del sábado
      
      console.log('Reporte SÁBADO:', inicioSabado, 'a', ultimoSabado);
      
      const reporteSabado = this.filtrarPorDiasEspecificos(
        inicioSabado,
        ultimoSabado,
        'sabado',
        [3, 4, 5],
        'Mié-Jue-Vie'
      );
      console.log('Reporte Sábado resultado:', reporteSabado);
      if (reporteSabado) {
        this.remuneraciones.push(reporteSabado);
      }

      this.reporteActual = 'miercoles';

    } else if (diaHoy === 6) {
      // HOY ES SÁBADO
      // Mostrar: Mié-Jue-Vie (3 días antes del sábado de hoy inclusive)
      const inicioSabado = new Date(hoy);
      inicioSabado.setDate(inicioSabado.getDate() - 3);
      
      console.log('HOY ES SÁBADO - Reporte SÁBADO:', inicioSabado, 'a', hoy);
      
      const reporteSabado = this.filtrarPorDiasEspecificos(
        inicioSabado,
        hoy,
        'sabado',
        [3, 4, 5],
        'Mié-Jue-Vie'
      );
      console.log('Reporte Sábado resultado:', reporteSabado);
      if (reporteSabado) {
        this.remuneraciones.push(reporteSabado);
      }

      // REPORTE MIÉRCOLES: 4 días antes del ÚLTIMO MIÉRCOLES (hace 3 días)
      const ultimoMiercoles = new Date(hoy);
      ultimoMiercoles.setDate(ultimoMiercoles.getDate() - 3); // Miércoles anterior
      const inicioMiercoles = new Date(ultimoMiercoles);
      inicioMiercoles.setDate(inicioMiercoles.getDate() - 4); // 4 días antes del miércoles
      
      console.log('Reporte MIÉRCOLES:', inicioMiercoles, 'a', ultimoMiercoles);
      
      const reporteMiercoles = this.filtrarPorDiasEspecificos(
        inicioMiercoles,
        ultimoMiercoles,
        'miercoles',
        [6, 0, 1, 2],
        'Sab-Dom-Lun-Mar'
      );
      console.log('Reporte Miércoles resultado:', reporteMiercoles);
      if (reporteMiercoles) {
        this.remuneraciones.push(reporteMiercoles);
      }

      this.reporteActual = 'sabado';

    } else if (diaHoy === 4 || diaHoy === 5) {
      // JUEVES O VIERNES: Próximo es SÁBADO
      const proximoSabado = new Date(hoy);
      const diasParaSabado = (6 - diaHoy + 7) % 7;
      proximoSabado.setDate(proximoSabado.getDate() + diasParaSabado);
      
      const inicioSabado = new Date(proximoSabado);
      inicioSabado.setDate(inicioSabado.getDate() - 3);
      
      console.log('JUEVES/VIERNES - Reporte SÁBADO (próximo):', inicioSabado, 'a', proximoSabado);
      
      const reporteSabado = this.filtrarPorDiasEspecificos(
        inicioSabado,
        proximoSabado,
        'sabado',
        [3, 4, 5],
        'Mié-Jue-Vie'
      );
      console.log('Reporte Sábado resultado:', reporteSabado);
      if (reporteSabado) {
        this.remuneraciones.push(reporteSabado);
      }

      // REPORTE MIÉRCOLES: ANTERIOR (pasado)
      const ultimoMiercoles = new Date(hoy);
      const diasAlMiercoles = (3 - diaHoy + 7) % 7;
      ultimoMiercoles.setDate(ultimoMiercoles.getDate() - (diasAlMiercoles === 0 ? 7 : diasAlMiercoles));
      
      const inicioMiercoles = new Date(ultimoMiercoles);
      inicioMiercoles.setDate(inicioMiercoles.getDate() - 4);
      
      console.log('Reporte MIÉRCOLES (anterior):', inicioMiercoles, 'a', ultimoMiercoles);
      
      const reporteMiercoles = this.filtrarPorDiasEspecificos(
        inicioMiercoles,
        ultimoMiercoles,
        'miercoles',
        [6, 0, 1, 2],
        'Sab-Dom-Lun-Mar'
      );
      console.log('Reporte Miércoles resultado:', reporteMiercoles);
      if (reporteMiercoles) {
        this.remuneraciones.push(reporteMiercoles);
      }

      this.reporteActual = 'sabado';

    } else {
      // DOMINGO, LUNES O MARTES: Próximo es MIÉRCOLES
      const proximoMiercoles = new Date(hoy);
      const diasParaMiercoles = (3 - diaHoy + 7) % 7;
      proximoMiercoles.setDate(proximoMiercoles.getDate() + diasParaMiercoles);
      
      const inicioMiercoles = new Date(proximoMiercoles);
      inicioMiercoles.setDate(inicioMiercoles.getDate() - 4);
      
      console.log('DOM/LUN/MAR - Reporte MIÉRCOLES (próximo):', inicioMiercoles, 'a', proximoMiercoles);
      
      const reporteMiercoles = this.filtrarPorDiasEspecificos(
        inicioMiercoles,
        proximoMiercoles,
        'miercoles',
        [6, 0, 1, 2],
        'Sab-Dom-Lun-Mar'
      );
      console.log('Reporte Miércoles resultado:', reporteMiercoles);
      if (reporteMiercoles) {
        this.remuneraciones.push(reporteMiercoles);
      }

      // REPORTE SÁBADO: ANTERIOR (pasado)
      const ultimoSabado = new Date(hoy);
      const diasAlSabado = (6 - diaHoy + 7) % 7;
      ultimoSabado.setDate(ultimoSabado.getDate() - (diasAlSabado === 0 ? 7 : diasAlSabado));
      
      const inicioSabado = new Date(ultimoSabado);
      inicioSabado.setDate(inicioSabado.getDate() - 3);
      
      console.log('Reporte SÁBADO (anterior):', inicioSabado, 'a', ultimoSabado);
      
      const reporteSabado = this.filtrarPorDiasEspecificos(
        inicioSabado,
        ultimoSabado,
        'sabado',
        [3, 4, 5],
        'Mié-Jue-Vie'
      );
      console.log('Reporte Sábado resultado:', reporteSabado);
      if (reporteSabado) {
        this.remuneraciones.push(reporteSabado);
      }

      this.reporteActual = 'miercoles';
    }

    console.log('Total remuneraciones:', this.remuneraciones.length);
  }

  private filtrarPorDiasEspecificos(
    fechaInicio: Date,
    fechaFin: Date,
    tipo: 'miercoles' | 'sabado',
    diasParaMostrar: number[],
    nombrePeriodo: string
  ): Remuneracion | null {
    const pedidosFiltrados = this.pedidos.filter(p => {
      // Incluir remunero, cancelado, enviado Y retirado
      if (!['remunero', 'cancelado', 'enviado', 'retirado', 'retirado-local'].includes(p.estado)) {
        return false;
      }

      const fecha = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      
      // Verificar que está en el rango de fechas Y es uno de los días que queremos
      if (fecha >= fechaInicio && fecha <= fechaFin) {
        const diaFecha = fecha.getDay();
        return diasParaMostrar.includes(diaFecha);
      }
      
      return false;
    });

    if (pedidosFiltrados.length === 0) {
      return null;
    }

    const pedidosDetalle = pedidosFiltrados.map(p => {
      const montoTotal = p.total || 0;
      const montoEnvio = p.monto_envio || 0;
      const montoSinEnvio = montoTotal - montoEnvio;
      
      const clienteNombre = this.obtenerNombreCliente(p.cliente_id);
      const destinoNombre = this.obtenerNombreDestino(p.destino_id, p.direccion_personalizada);
      const encomendistaNombre = this.obtenerNombreEncomendista(p.encomendista_id);

      return {
        id: p.id,
        cliente: clienteNombre,
        destino: destinoNombre,
        encomendista: encomendistaNombre,
        estado: p.estado,
        montoEnvio: montoEnvio,
        montoTotal: montoTotal,
        montoSinEnvio: montoSinEnvio,
        fechaEntrega: this.obtenerFechaEntrega(p.fecha_entrega_programada),
        fechaEntregaFormato: p.fecha_entrega_programada ? new Date(p.fecha_entrega_programada).toLocaleDateString('es-CL', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'
      };
    });

    // Separar por estado y calcular totales por estado
    const remunerados = pedidosDetalle.filter(p => p.estado === 'remunero');
    const cancelados = pedidosDetalle.filter(p => p.estado === 'cancelado');
    const enviados = pedidosDetalle.filter(p => p.estado === 'enviado');

    const totalEnvios = pedidosDetalle.reduce((sum, p) => sum + p.montoEnvio, 0);
    const totalSinEnvio = pedidosDetalle.reduce((sum, p) => sum + p.montoSinEnvio, 0);
    const totalGeneral = pedidosDetalle.reduce((sum, p) => sum + p.montoTotal, 0);

    // Calcular subtotales por estado
    const calcularSubtotales = (pedidos: any[]) => ({
      totalEnvios: pedidos.reduce((sum, p) => sum + p.montoEnvio, 0),
      totalSinEnvio: pedidos.reduce((sum, p) => sum + p.montoSinEnvio, 0),
      totalGeneral: pedidos.reduce((sum, p) => sum + p.montoTotal, 0)
    });

    return {
      fecha: new Date(),
      tipo: tipo,
      fechasIncluidas: nombrePeriodo,
      pedidos: pedidosDetalle,
      totalSinEnvio: totalSinEnvio,
      totalEnvios: totalEnvios,
      totalGeneral: totalGeneral,
      // Subtotales por estado
      remunerados: remunerados,
      cancelados: cancelados,
      enviados: enviados,
      subtotalesRemunerado: calcularSubtotales(remunerados),
      subtotalesCancelado: calcularSubtotales(cancelados),
      subtotalesEnviado: calcularSubtotales(enviados)
    };
  }

  toggleReporte(tipo: 'miercoles' | 'sabado') {
    this.reporteActual = tipo;
  }

  obtenerReporteActual(): Remuneracion | undefined {
    return this.remuneraciones.find(r => r.tipo === this.reporteActual);
  }

  private obtenerNombreCliente(clienteId: string): string {
    const cliente = this.clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nombre : 'Desconocido';
  }

  private obtenerNombreDestino(destinoId: string | null | undefined, direccionPersonalizada?: string): string {
    // Si no hay ID de destino, usar dirección personalizada
    if (!destinoId) {
      return direccionPersonalizada && direccionPersonalizada.trim() ? direccionPersonalizada : 'Personalizado';
    }
    
    // Buscar en todos los encomendistas
    for (const enc of this.encomendistas) {
      if (enc.destinos && Array.isArray(enc.destinos)) {
        const destino = enc.destinos.find((d: any) => d && (d.id === destinoId || d.nombre === destinoId));
        if (destino && destino.nombre) {
          return destino.nombre;
        }
      }
    }
    
    // Si no encuentra en destinos, pero hay dirección personalizada, usarla
    if (direccionPersonalizada && direccionPersonalizada.trim()) {
      return direccionPersonalizada;
    }
    
    console.warn(`⚠️ Destino no encontrado: "${destinoId}"`);
    
    return 'Personalizado';
  }

  private obtenerNombreEncomendista(encomendista_id?: string | null): string {
    if (!encomendista_id) return 'Personalizado';
    
    const enc = this.encomendistas.find(e => e && e.id === encomendista_id);
    if (!enc) {
      console.warn(`⚠️ Encomendista no encontrado: "${encomendista_id}"`);
    }
    return enc && enc.nombre ? enc.nombre : 'Personalizado';
  }

  toggleRemuneracion(index: number) {
    // Placeholder para futuras expansiones
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value).replace('CLP', '').trim();
  }

  getDiasSinRetirarColor(dias: number): string {
    if (dias <= 3) return 'text-green-600';
    if (dias <= 7) return 'text-yellow-600';
    return 'text-red-600';
  }

  getEstadoBadgeColor(estado: string): string {
    const colors: { [key: string]: string } = {
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'confirmado': 'bg-blue-100 text-blue-800',
      'pagado': 'bg-green-100 text-green-800',
      'empacado': 'bg-purple-100 text-purple-800',
      'en_ruta': 'bg-orange-100 text-orange-800',
      'entregado': 'bg-gray-100 text-gray-800',
      'cancelado': 'bg-red-100 text-red-800',
      'empacada': 'bg-purple-100 text-purple-800',
      'enviado': 'bg-blue-100 text-blue-800',
      'no-retirado': 'bg-red-100 text-red-800',
      'liberado': 'bg-green-100 text-green-800'
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  }
}