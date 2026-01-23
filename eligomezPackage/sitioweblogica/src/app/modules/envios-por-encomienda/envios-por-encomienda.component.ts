import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PedidosService, Pedido } from '../../service/pedidos/pedidos.service';
import { ClientesService } from '../../service/clientes/clientes.service';
import { EncomendistasService } from '../../service/encomendistas/encomendistas.service';
import { ModalNotificacionService } from '../../service/modal-notificacion/modal-notificacion.service';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface PedidoCompleto extends Pedido {
  cliente_nombre?: string;
  encomendista_nombre?: string;
}

interface EncomendaAgrupada {
  encomendista_nombre: string;
  pedidos: PedidoCompleto[];
  conteo: number;
  total: number;
}

@Component({
  selector: 'app-envios-por-encomienda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './envios-por-encomienda.component.html',
  styleUrls: ['./envios-por-encomienda.component.css']
})
export class EnviosPorEncomendaComponent implements OnInit, OnDestroy {
  pedidos: PedidoCompleto[] = [];
  clientes: any[] = [];
  encomendistas: any[] = [];
  
  encomiendasAgrupadas: EncomendaAgrupada[] = [];
  diaEnvioHoy: string = '';
  rangoFechas: { inicio: string; fin: string } = { inicio: '', fin: '' };
  cargando: boolean = false;
  mensajeVacio: string = '';
  totalPedidos: number = 0;
  
  // Zoom
  imagenZoom: string | null = null;
  mostrarZoom = false;

  private destroy$ = new Subject<void>();

  constructor(
    private pedidosService: PedidosService,
    private clientesService: ClientesService,
    private encomendistasService: EncomendistasService,
    private notificacionService: ModalNotificacionService
  ) {}

  ngOnInit() {
    // Cargar TODOS los datos en paralelo y esperar a que todos estén listos
    combineLatest([
      this.clientesService.cargarClientes(),
      this.encomendistasService.cargarEncomendistas(),
      this.pedidosService.cargarPedidos()
    ]).pipe(takeUntil(this.destroy$))
      .subscribe(([clientes, encomendistas, pedidos]) => {
        this.clientes = clientes;
        this.encomendistas = encomendistas;
        this.pedidos = pedidos as PedidoCompleto[];
        
        // Ahora sí enriquecemos (ya tenemos clientes y encomendistas)
        this.enriquecerPedidos();
        this.procesarEnvios();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Enriquece los pedidos con nombres de cliente y encomendista
   */
  enriquecerPedidos() {
    this.pedidos = this.pedidos.map(p => ({
      ...p,
      cliente_nombre: this.obtenerNombreCliente(p.cliente_id),
      encomendista_nombre: p.encomendista_id ? this.obtenerNombreEncomendista(p.encomendista_id) : 'Personalizado'
    }));
  }

  /**
   * Obtiene el nombre del cliente por ID
   */
  obtenerNombreCliente(cliente_id: string): string {
    return this.clientes.find(c => c.id === cliente_id)?.nombre || 'Sin cliente';
  }

  /**
   * Obtiene el nombre del encomendista por ID
   */
  obtenerNombreEncomendista(encomendista_id: string | undefined): string {
    if (!encomendista_id) return 'Personalizado';
    return this.encomendistas.find(e => e.id === encomendista_id)?.nombre || 'Personalizado';
  }

  /**
   * Procesa los envíos según el día actual
   */
  procesarEnvios() {
    this.cargando = true;
    const hoy = new Date();
    const diaHoy = hoy.getDay(); // 0=DOM, 1=LUN, 2=MAR, 3=MIÉ, 4=JUE, 5=VIE, 6=SAB

    // SIEMPRE empezar desde HOY para no perder pedidos programados para hoy
    let fechaInicio: Date = new Date(hoy);
    let fechaFin: Date = new Date(hoy);

    if (diaHoy === 3) {
      // Hoy es MIÉRCOLES - buscar para MIÉ/JUE/VIE (< SÁB)
      this.diaEnvioHoy = '📦 Envíos MIÉRCOLES - Para: Miércoles a Viernes';
      fechaFin = new Date(hoy);
      fechaFin.setDate(hoy.getDate() + 3); // MIÉ+3 = SÁB (se excluye con <)
    } else if (diaHoy === 6) {
      // Hoy es SÁBADO - buscar para SAB/DOM/LUN/MAR (< MIÉ)
      this.diaEnvioHoy = '📦 Envíos SÁBADO - Para: Sábado a Martes';
      fechaFin = new Date(hoy);
      fechaFin.setDate(hoy.getDate() + 4); // SÁB+4 = MIÉ (se excluye con <)
    } else {
      // Otro día - calcular próximo MIÉ o SAB
      const proximoDiaEnvio = this.calcularProximoDiaEnvio();
      const nombreDia = proximoDiaEnvio.getDay() === 3 ? 'MIÉRCOLES' : 'SÁBADO';
      this.diaEnvioHoy = `📦 Próximo Envío ${nombreDia}`;
      
      // IMPORTANTE: Incluir desde HOY hasta el próximo envío
      // Así no se pierden pedidos programados para hoy o días anteriores al envío
      fechaInicio = new Date(hoy); // SIMPRE desde HOY
      fechaFin = new Date(proximoDiaEnvio);
    }

    this.rangoFechas = {
      inicio: fechaInicio.toISOString().split('T')[0],
      fin: fechaFin.toISOString().split('T')[0]
    };

    this.filtrarYAgrupar(fechaInicio, fechaFin);
    this.cargando = false;
  }

  /**
   * Calcula el próximo día de envío (MIÉRCOLES o SÁBADO)
   */
  private calcularProximoDiaEnvio(): Date {
    const hoy = new Date();
    const diaHoy = hoy.getDay();
    
    let diasHastaMiercoles = (3 - diaHoy + 7) % 7;
    let diasHastaSabado = (6 - diaHoy + 7) % 7;
    
    if (diasHastaMiercoles === 0) diasHastaMiercoles = 7;
    if (diasHastaSabado === 0) diasHastaSabado = 7;
    
    let diasHasta = Math.min(diasHastaMiercoles, diasHastaSabado);
    
    const proximoEnvio = new Date(hoy);
    proximoEnvio.setDate(hoy.getDate() + diasHasta);
    proximoEnvio.setHours(0, 0, 0, 0);
    
    return proximoEnvio;
  }

  /**
   * Filtra y agrupa los pedidos por encomendista
   */
  private filtrarYAgrupar(fechaInicio: Date, fechaFin: Date) {
    // ⚠️ IMPORTANTE: Comparar SOLO año/mes/día (sin hora ni zona horaria)
    // Convertimos a string YYYY-MM-DD en hora LOCAL para evitar problemas de timezone
    const formatoFecha = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const inicioStr = formatoFecha(fechaInicio);
    const finStr = formatoFecha(fechaFin);
    
    console.log(`[Filtro] Buscando pedidos del ${inicioStr} al ${finStr} (solo fecha, sin hora)`);
    
    // Filtrar: solo pendiente/empacada y que la fecha esté en el rango
    const pedidosFiltrados = this.pedidos.filter(p => {
      if (!['pendiente', 'empacada'].includes(p.estado)) return false;
      
      const fechaEntrega = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      const fechaEntregaStr = formatoFecha(fechaEntrega);
      
      // Comparar strings YYYY-MM-DD - usar < para excluir el día del próximo envío
      const dentroDeRango = fechaEntregaStr >= inicioStr && fechaEntregaStr < finStr;
      
      if (!dentroDeRango) {
        console.log(`[Filtro] Pedido ${p.codigo_pedido || p.id} (${fechaEntregaStr}) FUERA de rango ${inicioStr} a ${finStr}`);
      } else {
        console.log(`[Filtro] ✅ Pedido ${p.codigo_pedido || p.id} (${fechaEntregaStr}) DENTRO de rango`);
      }
      
      return dentroDeRango;
    });

    if (pedidosFiltrados.length === 0) {
      this.mensajeVacio = `No hay pedidos para empacar en este rango de fechas (${this.rangoFechas.inicio} a ${this.rangoFechas.fin})`;
      this.encomiendasAgrupadas = [];
      this.totalPedidos = 0;
      return;
    }

    // Agrupar por encomendista
    const grupos = new Map<string, PedidoCompleto[]>();
    pedidosFiltrados.forEach(p => {
      const encomienda = p.encomendista_nombre || 'Sin Encomienda';
      if (!grupos.has(encomienda)) {
        grupos.set(encomienda, []);
      }
      grupos.get(encomienda)!.push(p);
    });

    // Convertir a array de EncomendaAgrupada
    this.encomiendasAgrupadas = Array.from(grupos.entries()).map(([nombre, pedidos]) => ({
      encomendista_nombre: nombre,
      pedidos,
      conteo: pedidos.length,
      total: pedidos.reduce((sum, p) => sum + (p.total || 0), 0)
    }));

    this.totalPedidos = pedidosFiltrados.length;
    this.mensajeVacio = '';
  }

  /**
   * Obtiene la fecha de entrega del pedido (maneja Timestamp de Firestore, Date, string ISO)
   */
  private obtenerFechaEntrega(fecha: any): Date {
    if (!fecha) return new Date();
    
    // Timestamp de Firestore (tiene método toDate)
    if (fecha.toDate && typeof fecha.toDate === 'function') {
      return fecha.toDate();
    }
    
    // Ya es Date
    if (fecha instanceof Date) return fecha;
    
    // ✅ SI es string YYYY-MM-DD, parsearlo correctamente sin timezone issues
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const [year, month, day] = fecha.split('-').map(Number);
      // Crear fecha en zona horaria LOCAL (no UTC)
      return new Date(year, month - 1, day);
    }
    
    // String ISO o similar
    if (typeof fecha === 'string') {
      const parsed = new Date(fecha);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    
    // Objeto con seconds (formato Firestore serializado)
    if (fecha.seconds) {
      return new Date(fecha.seconds * 1000);
    }
    
    return new Date();
  }

  /**
   * Marca todos los pedidos de una encomienda como "enviado"
   */
  async marcarEncomendaComoEnviada(encomiendaAgrupada: EncomendaAgrupada) {
    const confirmacion = confirm(`¿Marcar ${encomiendaAgrupada.conteo} pedido(s) de ${encomiendaAgrupada.encomendista_nombre} como enviado?`);
    if (!confirmacion) return;

    try {
      for (const pedido of encomiendaAgrupada.pedidos) {
        const pedidoActualizado = { ...pedido, estado: 'enviado' as const };
        await this.pedidosService.actualizarPedido(pedidoActualizado);
      }

      // Recargar
      this.pedidosService.cargarPedidos()
        .pipe(takeUntil(this.destroy$))
        .subscribe((pedidos: Pedido[]) => {
          this.pedidos = pedidos as PedidoCompleto[];
          this.enriquecerPedidos();
          this.procesarEnvios();
        });

      this.notificacionService.mostrarExito(`Se marcaron ${encomiendaAgrupada.conteo} pedido(s) como enviados`);
    } catch (error) {
      this.notificacionService.mostrarError('Error al marcar como enviado: ' + error);
    }
  }

  /**
   * Obtiene color de header por estado
   */
  obtenerColorHeader(estado: string): string {
    const estadoLower = estado?.toLowerCase();
    const colores: { [key: string]: string } = {
      'pendiente': 'bg-yellow-600 text-white',
      'empacada': 'bg-pink-600 text-white',
      'enviado': 'bg-purple-600 text-white',
      'retirado': 'bg-green-600 text-white',
      'no-retirado': 'bg-orange-600 text-white',
      'cancelado': 'bg-red-600 text-white',
      'retirado-local': 'bg-gray-900 text-white',
      'liberado': 'bg-amber-700 text-white',
      'remunero': 'bg-teal-600 text-white'
    };
    return colores[estadoLower] || 'bg-gray-600 text-white';
  }

  /**
   * Obtiene color de body por estado (con dark mode)
   */
  obtenerColorBody(estado: string): string {
    const estadoLower = estado?.toLowerCase();
    const colores: { [key: string]: string } = {
      'pendiente': 'bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-600',
      'empacada': 'bg-pink-50 dark:bg-pink-900/30 border-l-4 border-pink-600',
      'enviado': 'bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-600',
      'retirado': 'bg-green-50 dark:bg-green-900/30 border-l-4 border-green-600',
      'no-retirado': 'bg-orange-50 dark:bg-orange-900/30 border-l-4 border-orange-600',
      'cancelado': 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-600',
      'retirado-local': 'bg-gray-50 dark:bg-gray-900/50 border-l-4 border-gray-900 dark:border-gray-400',
      'liberado': 'bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-700',
      'remunero': 'bg-teal-50 dark:bg-teal-900/30 border-l-4 border-teal-600'
    };
    return colores[estadoLower] || 'bg-gray-50 dark:bg-gray-900/30 border-l-4 border-gray-600';
  }

  /**
   * Obtiene emoji por estado
   */
  obtenerEmojiEstado(estado: string): string {
    const emojis: { [key: string]: string } = {
      'pendiente': '🟡',
      'empacada': '📦',
      'enviado': '✈️',
      'retirado': '✅',
      'no-retirado': '❌',
      'cancelado': '🚫',
      'retirado-local': '📍',
      'liberado': '🔓',
      'remunero': '💵'
    };
    return emojis[estado?.toLowerCase()] || '❓';
  }

  /**
   * Formatea el estado para mostrar
   */
  formatearEstado(estado: string): string {
    const palabras: { [key: string]: string } = {
      'pendiente': 'Pendiente',
      'empacada': 'Empacada',
      'enviado': 'Enviado',
      'retirado': 'Retirado',
      'no-retirado': 'No Retirado',
      'cancelado': 'Cancelado',
      'retirado-local': 'Retirado Local',
      'liberado': 'Liberado',
      'remunero': 'Remunerado'
    };
    return palabras[estado?.toLowerCase()] || estado || 'Desconocido';
  }

  /**
   * Abre zoom de imagen
   */
  abrirZoom(imagenUrl: string) {
    if (imagenUrl) {
      this.imagenZoom = imagenUrl;
      this.mostrarZoom = true;
    }
  }

  /**
   * Cierra zoom de imagen
   */
  cerrarZoom() {
    this.mostrarZoom = false;
    this.imagenZoom = null;
  }
}
