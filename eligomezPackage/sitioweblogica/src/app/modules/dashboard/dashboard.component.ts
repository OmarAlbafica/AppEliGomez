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
    const pedidosSub = this.pedidosService.cargarPedidos().subscribe((pedidos: Pedido[]) => {
      this.pedidos = pedidos;
      this.calcularEstadisticas();
    });
    this.subscriptions.push(pedidosSub);

    const clientesSub = this.clientesService.cargarClientes().subscribe((clientes: Cliente[]) => {
      this.clientes = clientes;
    });
    this.subscriptions.push(clientesSub);

    const encomendistaSub = this.encomendistasService.cargarEncomendistas().subscribe((encomendistas: Encomendista[]) => {
      this.encomendistas = encomendistas;
    });
    this.subscriptions.push(encomendistaSub);
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

  private obtenerNombreCliente(clienteId: string): string {
    return this.clientes.find(c => c.id === clienteId)?.nombre || 'Desconocido';
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

  toggleRetiroHoy(index: number) {
    this.retiroHoy[index].expanded = !this.retiroHoy[index].expanded;
  }

  toggleRetiroTomorrow(index: number) {
    this.retiroTomorrow[index].expanded = !this.retiroTomorrow[index].expanded;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(value);
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