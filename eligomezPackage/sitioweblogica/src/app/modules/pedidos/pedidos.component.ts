import { Component, OnInit, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResponsiveService } from '../../service/responsive/responsive.service';
import { PedidosService, Pedido } from '../../service/pedidos/pedidos.service';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { EncomendistasService, Encomendista, DestinoEncomendista } from '../../service/encomendistas/encomendistas.service';
import { ProductosService, Producto } from '../../service/productos/productos.service';
import { TiendasService } from '../../service/tiendas/tiendas.service';
import { ModalConfirmacionService } from '../../service/modal-confirmacion/modal-confirmacion.service';
import { ModalNotificacionService } from '../../service/modal-notificacion/modal-notificacion.service';
import { Tienda } from '../../models/tienda.model';
import { Subscription } from 'rxjs';
import { StickerPdfService } from '../../service/pdf/sticker-pdf.service';
import { StickerPreviewModalComponent } from './sticker-preview-modal.component';
import { ImportarExcelModalComponent } from './importar-excel-modal.component';

interface PedidoCompleto extends Pedido {
  cliente_nombre?: string;
  encomendista_nombre?: string;
  nombre_tienda?: string;
  color_sticker?: string;
  logo_tienda?: string;
}

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule, StickerPreviewModalComponent, ImportarExcelModalComponent],
  templateUrl: './pedidos.component.html',
  styleUrls: ['./pedidos.component.css']
})
export class PedidosComponent implements OnInit, OnDestroy {
  @ViewChild(ImportarExcelModalComponent) importarExcelModal!: ImportarExcelModalComponent;
  
  isMobile: boolean = false;
  pedidos: PedidoCompleto[] = [];
  clientes: Cliente[] = [];
  encomendistas: Encomendista[] = [];
  productos: Producto[] = [];
  tiendas: Tienda[] = [];  // NUEVO: Agregar tiendas
  tiendaSeleccionada: Tienda | null = null;  // NUEVO: Tienda seleccionada para crear pedido

  filtroEstado = 'sin-finalizar';
  filtroNombre = '';
  estadosList = ['pendiente', 'empacada', 'enviado', 'retirado', 'no-retirado', 'retirado-local', 'cancelado', 'liberado', 'remunero'];
  // Array con todos los filtros posibles incluyendo opciones especiales
  estados = ['sin-finalizar', 'todos', 'urgentes-empacar', 'por-enviar', 'enviados', 'por-remunerar', 'por-retirar-hoy', 'pendiente', 'empacada', 'enviado', 'retirado', 'no-retirado', 'retirado-local', 'cancelado', 'liberado', 'remunero'];
  // Array SOLO para el modal de cambio de estado - solo los 8 estados principales
  estadosParaModal = ['pendiente', 'empacada', 'enviado', 'retirado', 'no-retirado', 'retirado-local', 'cancelado', 'liberado', 'remunero'];

  // Control de banner urgentes
  mostrarUrgentes = false;

  /**
   * Obtiene los nombres formateados de los pedidos urgentes
   */
  obtenerNombresUrgentes(): string {
    return this.obtenerPedidosUrgencia()
      .map(p => (p.cliente_nombre || 'Cliente').split(' ')[0])
      .join(', ');
  }

  // Modal de cambio de estado
  mostrarModalEstado = false;
  pedidoSeleccionado: PedidoCompleto | null = null;

  nuevoEstado: string = '';

  // Filtro por fecha
  filtroFechaDesde: string = '';
  filtroFechaHasta: string = '';

  // Filtro de días para "por-retirar-hoy"
  diasRetiroSeleccionado: number = 0; // 0 = Hoy, 1 = Ayer, 2 = Anteayer, etc.

  // Zoom de imagen
  imagenZoom: string | null = null;
  mostrarZoom = false;



  // Pedidos expandidos para ver detalles
  pedidosExpandidos: Set<string> = new Set();

  // Modal de preview de stickers
  mostrarModalPreview = false;
  pedidosParaPreview: PedidoCompleto[] = [];
  fechaEnvio: Date | null = null;
  
  // Modal de fecha de envío
  mostrarModalFechaEnvio = false;
  fechaTemporal: string = '';

  // Selección de pedidos para stickers
  pedidosSeleccionados: Set<string> = new Set();
  mostrarSelectorStickers = false;

  // Foto del paquete empacado
  fotoSeleccionada: File | null = null;
  fotoPreview: string | ArrayBuffer | null = null;

  // Modal para cargar imagen de paquete
  mostrarModalCargarImagen = false;
  pedidoParaCargarImagen: PedidoCompleto | null = null;
  imagenPaqueteBase64: string | null = null;
  imagenPaquetePreview: string | ArrayBuffer | null = null;

  // Modal de importación de Excel
  mostrarImportarExcel = false;

  // Modal de edición puntual de pedidos
  mostrarModalEdicionPuntual = false;
  pedidoEnEdicion: PedidoCompleto | null = null;
  edicionForm = {
    tienda_id: '', // NUEVO: Para cambiar tienda en edición
    encomendista_id: '',
    destino_id: '',
    dia_entrega: '',
    hora_inicio: '',
    hora_fin: '',
    costo_prendas: 0,
    monto_envio: 0,
    notas: '',
    tipo_envio: 'normal', // 'normal' o 'personalizado'
    direccion_personalizada: '' // Para envíos personalizados
  };
  destinosDisponiblesEdicion: DestinoEncomendista[] = [];
  
  // Búsqueda de encomendista en edición
  nombreEncomendistaBusquedaEdicion: string = '';
  encomendistaBuscadasEdicion: Encomendista[] = [];
  
  // Búsqueda de destino en edición
  nombreDestinoBusquedaEdicion: string = '';
  destinosBuscadosEdicion: DestinoEncomendista[] = [];
  
  // Selección de día y fechas en edición
  diasProximosEdicion: { dia: string; proximoHorario?: { hora_inicio: string; hora_fin: string } }[] = [];
  fechasDisponiblesEdicion: { fecha: Date; fechaFormato: string }[] = [];
  fechasOffsetEdicion: number = 0;
  fechaSeleccionadaEdicion: string = ''; // Almacena la fecha seleccionada en formato legible
  diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  // Ordenamiento de tabla
  ordenarPor: 'cliente' | 'encomendista' = 'cliente';
  direccionOrden: 'asc' | 'desc' = 'asc';

  private subscriptions: Subscription[] = [];
  constructor(
    private pedidosService: PedidosService,
    private clientesService: ClientesService,
    private encomendistasService: EncomendistasService,
    private productosService: ProductosService,
    private tiendasService: TiendasService,
    private stickerPdfService: StickerPdfService,
    private modalService: ModalConfirmacionService,
    private notificacionService: ModalNotificacionService,
    private responsiveService: ResponsiveService
  ) {}

  ngOnInit() {
    this.isMobile = this.responsiveService.getIsMobile();
    this.responsiveService.isMobile$.subscribe((val: boolean) => this.isMobile = val);
    // Suscribir PRIMERO antes de cargar datos
    this.cargarClientes();
    this.cargarEncomendistas();
    this.cargarProductos();
    this.cargarTiendas();  // NUEVO: Cargar tiendas
    this.cargarPedidos();

    // LUEGO cargar desde Firebase
    console.log('Iniciando carga de datos...');
    Promise.all([
      this.clientesService.recargarClientes(),
      this.encomendistasService.cargarEncomendistas().toPromise(),
      this.productosService.recargarProductos(),
      this.tiendasService.cargarTiendas().toPromise(),  // NUEVO: Cargar tiendas desde Firebase
      this.pedidosService.recargarPedidos()
    ]).then(() => {
      console.log('Datos cargados correctamente');
    }).catch(error => {
      console.error('Error en carga de datos:', error);
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  cargarClientes() {
    const sub = this.clientesService.cargarClientes().subscribe((clientes: Cliente[]) => {
      this.clientes = clientes;
      this.enriquecerPedidos();
    });
    this.subscriptions.push(sub);
  }

  cargarEncomendistas() {
    const sub = this.encomendistasService.cargarEncomendistas().subscribe((encomendistas: Encomendista[]) => {
      this.encomendistas = encomendistas;
      this.enriquecerPedidos();
    });
    this.subscriptions.push(sub);
  }

  cargarPedidos() {
    const sub = this.pedidosService.cargarPedidos().subscribe((pedidos: Pedido[]) => {
     
      this.pedidos = pedidos as PedidoCompleto[];
      this.enriquecerPedidos();
    });
    this.subscriptions.push(sub);
  }

  cargarProductos() {
    const sub = this.productosService.cargarProductos().subscribe((productos: Producto[]) => {
      this.productos = productos;
    });
    this.subscriptions.push(sub);
  }

  cargarTiendas() {  // NUEVO: Método para cargar tiendas
    const sub = this.tiendasService.cargarTiendas().subscribe((tiendas: Tienda[]) => {
      this.tiendas = tiendas;
      console.log('Tiendas cargadas:', tiendas.length);
    });
    this.subscriptions.push(sub);
  }

  /**
   * Obtiene los productos de un pedido por sus IDs
   */
  obtenerProductosDePedido(pedido: PedidoCompleto): Producto[] {
    if (!pedido.productos_id || pedido.productos_id.length === 0) {
      return [];
    }
    return this.productos.filter(p => pedido.productos_id!.includes(p.id));
  }

  /**
   * Obtiene los códigos de los productos del pedido
   */
  obtenerCodigosDePedido(pedido: PedidoCompleto): string {
    if (pedido.productos_codigos && pedido.productos_codigos.length > 0) {
      return pedido.productos_codigos.join(', ');
    }
    // Si no hay códigos almacenados, intentar obtenerlos de los productos
    const codigos = this.obtenerProductosDePedido(pedido).map(p => p.codigo);
    return codigos.length > 0 ? codigos.join(', ') : 'Sin códigos';
  }

  /**
   * Abre zoom de imagen
   */
  abrirZoom(imagenUrl: string) {
    this.imagenZoom = imagenUrl;
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
   * Alterna la expansión de un pedido
   */
  alternarExpansion(pedidoId: string) {
    if (this.pedidosExpandidos.has(pedidoId)) {
      this.pedidosExpandidos.delete(pedidoId);
    } else {
      this.pedidosExpandidos.add(pedidoId);
    }
  }

  /**
   * Verifica si un pedido está expandido
   */
  estaPedidoExpandido(pedidoId: string): boolean {
    return this.pedidosExpandidos.has(pedidoId);
  }

  /**
   * Enriquece los pedidos con nombres de cliente y encomendista
   */
  enriquecerPedidos() {
 
    this.pedidos = this.pedidos.map((p, index) => {
      const tienda = this.tiendas.find(t => t.id === p.tienda_id);
      const cliente = this.clientes.find(c => c.id === p.cliente_id);
      const pedidoEnriquecido = {
        ...p,
        cliente_nombre: this.obtenerNombreCliente(p.cliente_id),
        telefono_cliente: cliente?.telefono,
        encomendista_nombre: p.encomendista_id ? this.obtenerNombreEncomendista(p.encomendista_id) : 'Personalizado',
        nombre_tienda: tienda?.nombre_pagina || 'Eli Gomez',
        color_sticker: tienda?.color_sticker || '#ec4899',
        logo_tienda: tienda?.imagen_url || 'assets/images/logoeligomez.jpg'
      };
      
      
      return pedidoEnriquecido;
    });
  }

  /**
   * Obtiene el nombre del cliente por ID
   */
  obtenerNombreCliente(cliente_id: string): string {
    const cliente = this.clientes.find(c => c.id === cliente_id);
    return cliente ? cliente.nombre : 'Desconocido';
  }

  /**
   * Obtiene el nombre del encomendista por ID
   */
  obtenerNombreEncomendista(encomendista_id: string): string {
    const encomendista = this.encomendistas.find(e => e.id === encomendista_id);
    return encomendista ? encomendista.nombre : 'Desconocido';
  }

  /**
   * Convierte hora formato 24h ("09:00") a formato 12h ("9am")
   */
  convertirHora12(hora24: string | undefined): string {
    if (!hora24) return '';
    
    try {
      const [horas, minutos] = hora24.split(':');
      const h = parseInt(horas, 10);
      const periodo = h >= 12 ? 'pm' : 'am';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return minutos && minutos !== '00' ? `${h12}:${minutos}${periodo}` : `${h12}${periodo}`;
    } catch {
      return hora24;
    }
  }

  getPedidosFiltrados() {
    const pedidosFiltrados = this.pedidos.filter(p => {
      // Filtro por nombre/búsqueda
      if (this.filtroNombre.trim()) {
        const busqueda = this.filtroNombre.toLowerCase();
        const coincide = (
          (p.cliente_nombre && p.cliente_nombre.toLowerCase().includes(busqueda)) ||
          (p.codigo_pedido && p.codigo_pedido.toLowerCase().includes(busqueda)) ||
          (p.nombre_tienda && p.nombre_tienda.toLowerCase().includes(busqueda)) ||
          (p.encomendista_nombre && p.encomendista_nombre.toLowerCase().includes(busqueda))
        );
        if (!coincide) return false;
      }

      // Filtro por estado (incluyendo opciones especiales)
      if (this.filtroEstado === 'sin-finalizar') {
        // Sin finalizar = todos EXCEPTO no-retirado, cancelado, retirado-local
        if (['no-retirado', 'cancelado', 'retirado-local'].includes(p.estado)) {
          return false;
        }
      } else if (this.filtroEstado === 'urgentes-empacar') {
        // Mostrar solo los urgentes
        if (!this.esUrgente(p)) {
          return false;
        }
      } else if (this.filtroEstado === 'por-enviar') {
        // Por enviar = pendiente + empacada
        if (!['pendiente', 'empacada'].includes(p.estado)) {
          return false;
        }
      } else if (this.filtroEstado === 'enviados') {
        // Enviados = estado enviado
        if (p.estado !== 'enviado') {
          return false;
        }
      } else if (this.filtroEstado === 'por-remunerar') {
        // Por remunerar = NO enviado, retirados, no retirados desde la fecha actual hacia atrás
        // NO está en: liberado, retirado-local, cancelado, pendiente, empacada, remunero
        const finalizados = ['liberado', 'retirado-local', 'cancelado', 'pendiente', 'empacada', 'remunero'];
        if (finalizados.includes(p.estado)) {
          return false;
        }
        // Además, solo mostrar desde hoy hacia atrás
        const fechaPedido = this.obtenerFechaEntrega(p.fecha_entrega_programada);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (fechaPedido > hoy) {
          return false;
        }
      } else if (this.filtroEstado === 'por-retirar-hoy') {
        // Por retirar hoy/ayer/anteayer etc = fecha entrega es la seleccionada Y estado es ENVIADO (aún no retirado)
        if (p.estado !== 'enviado') {
          return false;
        }
        const fechaPedido = this.obtenerFechaEntrega(p.fecha_entrega_programada);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        // Restar los días seleccionados (diasRetiroSeleccionado)
        const fechaFiltro = new Date(hoy);
        fechaFiltro.setDate(fechaFiltro.getDate() - this.diasRetiroSeleccionado);
        
        const mañanaFiltro = new Date(fechaFiltro);
        mañanaFiltro.setDate(mañanaFiltro.getDate() + 1);
        
        if (fechaPedido < fechaFiltro || fechaPedido >= mañanaFiltro) {
          return false;
        }
      } else if (this.filtroEstado !== 'todos' && p.estado !== this.filtroEstado) {
        return false;
      }

      // Filtro por fecha
      if (this.filtroFechaDesde || this.filtroFechaHasta) {
        const fechaPedido = this.obtenerFechaEntrega(p.fecha_entrega_programada);
        
        if (this.filtroFechaDesde) {
          const desdeDate = new Date(this.filtroFechaDesde);
          if (fechaPedido < desdeDate) return false;
        }

        if (this.filtroFechaHasta) {
          const hastaDate = new Date(this.filtroFechaHasta);
          // Sumar un día a hasta para incluir todo el día
          hastaDate.setDate(hastaDate.getDate() + 1);
          if (fechaPedido >= hastaDate) return false;
        }
      }

      return true;
    });
    
    // SIEMPRE ordenar por fecha de entrega (la más próxima primero)
    // Pero PRIMERO mostrar los pedidos urgentes (que van para el próximo envío)
    // Si es filtro "por-retirar-hoy", ordenar por hora en lugar de fecha
    pedidosFiltrados.sort((a, b) => {
      // Si es filtro "por-retirar-hoy", ordenar por estado de prioridad y luego por hora
      if (this.filtroEstado === 'por-retirar-hoy') {
        // Función para obtener prioridad del estado
        const obtenerPrioridad = (pedido: PedidoCompleto): number => {
          const estado = this.obtenerEstadoPedido(pedido);
          if (estado === 'Pendiente') return 1;      // Primero
          if (estado === 'A punto') return 2;        // Segundo
          if (estado === 'En Curso') return 3;       // Tercero
          if (estado === 'Pasado') return 4;         // Último (gris)
          return 5; // Fallback
        };

        const prioridadA = obtenerPrioridad(a);
        const prioridadB = obtenerPrioridad(b);

        // Si diferente prioridad, ordenar por prioridad
        if (prioridadA !== prioridadB) {
          return prioridadA - prioridadB;
        }

        // Si misma prioridad, ordenar por hora
        const horaA = a.hora_inicio ? parseInt(a.hora_inicio.split(':')[0]) : 0;
        const horaB = b.hora_inicio ? parseInt(b.hora_inicio.split(':')[0]) : 0;
        const minutoA = a.hora_inicio ? parseInt(a.hora_inicio.split(':')[1]) : 0;
        const minutoB = b.hora_inicio ? parseInt(b.hora_inicio.split(':')[1]) : 0;
        
        const tiempoA = horaA * 60 + minutoA;
        const tiempoB = horaB * 60 + minutoB;
        
        return tiempoA - tiempoB;
      }
      
      // Para 'sin-finalizar', agrupar por estado primero, luego por encomendista, luego por fecha
      if (this.filtroEstado === 'sin-finalizar') {
        // Orden de prioridad de estados: urgentes > pendientes > empacados > enviados > retirado > remunerado > cancelado > retirado-local
        const ordenEstados = {
          'pendiente': 1,     // Se incluyen los urgentes (que tienen estado pendiente)
          'empacada': 2,
          'enviado': 3,
          'retirado': 4,
          'remunero': 5,
          'cancelado': 6,
          'no-retirado': 99,  // No debería aparecer (filtrado arriba)
          'retirado-local': 99, // No debería aparecer (filtrado arriba)
          'liberado': 7
        };

        // Si alguno es urgente, priorizarlos
        const aEsUrgente = this.esUrgente(a);
        const bEsUrgente = this.esUrgente(b);
        
        if (aEsUrgente && !bEsUrgente) return -1;
        if (!aEsUrgente && bEsUrgente) return 1;
        
        // Ordenar por estado
        const prioridadA = ordenEstados[a.estado as keyof typeof ordenEstados] || 99;
        const prioridadB = ordenEstados[b.estado as keyof typeof ordenEstados] || 99;
        
        if (prioridadA !== prioridadB) {
          return prioridadA - prioridadB;
        }
        
        // Mismo estado: ordenar por encomendista
        const encA = (a.encomendista_id ? this.obtenerNombreEncomendista(a.encomendista_id) : 'Personalizado').toLowerCase();
        const encB = (b.encomendista_id ? this.obtenerNombreEncomendista(b.encomendista_id) : 'Personalizado').toLowerCase();
        const comparacionEnc = encA.localeCompare(encB);
        
        if (comparacionEnc !== 0) {
          return comparacionEnc;
        }
        
        // Mismo encomendista: ordenar por fecha (más próxima primero)
        const fechaA = this.obtenerFechaEntrega(a.fecha_entrega_programada);
        const fechaB = this.obtenerFechaEntrega(b.fecha_entrega_programada);
        return fechaA.getTime() - fechaB.getTime();
      }
      
      // Criterio primario: Si es urgente (va para próximo envío), mostrar primero
      const aEsUrgente = this.esUrgente(a);
      const bEsUrgente = this.esUrgente(b);
      
      if (aEsUrgente && !bEsUrgente) return -1; // a va primero (urgente)
      if (!aEsUrgente && bEsUrgente) return 1;  // b va primero (urgente)
      
      // Criterio secundario: Fecha de entrega (más próxima primero)
      const fechaA = this.obtenerFechaEntrega(a.fecha_entrega_programada);
      const fechaB = this.obtenerFechaEntrega(b.fecha_entrega_programada);
      const difFechas = fechaA.getTime() - fechaB.getTime();
      
      if (difFechas !== 0) {
        return difFechas;
      }
      
      // Criterio terciario: cliente o encomendista según la selección
      if (this.ordenarPor === 'cliente') {
        const clienteA = this.obtenerNombreCliente(a.cliente_id).toLowerCase();
        const clienteB = this.obtenerNombreCliente(b.cliente_id).toLowerCase();
        const comparacion = clienteA.localeCompare(clienteB);
        return this.direccionOrden === 'asc' ? comparacion : -comparacion;
      } else if (this.ordenarPor === 'encomendista') {
        const encA = (a.encomendista_id ? this.obtenerNombreEncomendista(a.encomendista_id) : 'Personalizado').toLowerCase();
        const encB = (b.encomendista_id ? this.obtenerNombreEncomendista(b.encomendista_id) : 'Personalizado').toLowerCase();
        const comparacion = encA.localeCompare(encB);
        return this.direccionOrden === 'asc' ? comparacion : -comparacion;
      }
      
      return 0;
    });

    return pedidosFiltrados;
  }

  /**
   * Alterna el ordenamiento de una columna
   */
  alternarOrdenamiento(columna: 'cliente' | 'encomendista') {
    if (this.ordenarPor === columna) {
      // Si ya está ordenada por esta columna, cambiar dirección
      this.direccionOrden = this.direccionOrden === 'asc' ? 'desc' : 'asc';
    } else {
      // Si es otra columna, establecerla como orden principal (ascendente)
      this.ordenarPor = columna;
      this.direccionOrden = 'asc';
    }
  }

  /**
   * Obtiene el indicador visual de ordenamiento
   */
  obtenerIndicadorOrdenamiento(columna: 'cliente' | 'encomendista'): string {
    if (this.ordenarPor !== columna) return '↕️';
    return this.direccionOrden === 'asc' ? '↑' : '↓';
  }

  /**
   * Extrae la fecha de entrega del pedido (es un timestamp de Firestore o Date)
   */
  obtenerFechaEntrega(fecha: any): Date {
    if (!fecha) return new Date();
    
    // ✅ SI es string YYYY-MM-DD, parsearlo correctamente sin timezone issues
    if (typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const [year, month, day] = fecha.split('-').map(Number);
      // Crear fecha en zona horaria LOCAL (no UTC)
      return new Date(year, month - 1, day);
    }
    
    if (fecha instanceof Date) return fecha;
    if (typeof fecha === 'string') return new Date(fecha);
    if (fecha.toDate && typeof fecha.toDate === 'function') return fecha.toDate(); // Timestamp de Firestore
    return new Date(fecha);
  }

  /**
   * Formatea la fecha de entrega para mostrar
   */
  formatearFechaEntrega(fecha: any): string {
    const fechaObj = this.obtenerFechaEntrega(fecha);
    const opciones: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return fechaObj.toLocaleDateString('es-ES', opciones);
  }

  verPedido(pedido: PedidoCompleto) {
    this.pedidoSeleccionado = pedido;
    this.nuevoEstado = pedido.estado;
    this.mostrarModalEstado = true;
  }

  editarPedido(pedido: PedidoCompleto) {
    this.pedidoSeleccionado = pedido;
    this.nuevoEstado = pedido.estado;
    this.mostrarModalEstado = true;
  }

  /**
   * Abre modal para cambiar estado del pedido
   */
  abrirModalEstado(pedido: PedidoCompleto) {
    this.pedidoSeleccionado = pedido;
    this.nuevoEstado = pedido.estado;
    this.mostrarModalEstado = true;
    // Limpiar foto si la hay
    this.fotoSeleccionada = null;
    this.fotoPreview = null;
  }

  /**
   * Cierra el modal de cambio de estado
   */
  cerrarModalEstado() {
    this.mostrarModalEstado = false;
    this.pedidoSeleccionado = null;
    this.nuevoEstado = '';
    this.fotoSeleccionada = null;
    this.fotoPreview = null;
  }

  /**
   * Verifica si un pedido tiene foto del paquete
   */
  tieneFotoPaquete(pedido: PedidoCompleto): boolean {
    return !!pedido.foto_paquete;
  }

  /**
   * Verifica si el pedido está en estado empacada o posterior
   */
  esEstadoEmpacadoOPosterior(estado: string): boolean {
    const estadosEmpacadoOPosterior = ['empacada', 'enviado', 'retirado', 'no-retirado', 'retirado-local', 'liberado'];
    return estadosEmpacadoOPosterior.includes(estado);
  }

  /**
   * Abre zoom de la foto del paquete
   */
  verFotoPaquete(pedido: PedidoCompleto) {
    if (pedido.foto_paquete) {
      this.imagenZoom = pedido.foto_paquete;
      this.mostrarZoom = true;
    }
  }

  /**
   * Maneja la selección de la foto del paquete
   */
  onFotoSeleccionada(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        this.notificacionService.mostrarError('Por favor selecciona una imagen válida (JPG, PNG, etc.)');
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.notificacionService.mostrarError('La imagen es muy grande. Máximo 5MB');
        return;
      }

      this.fotoSeleccionada = file;

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.fotoPreview = e.target?.result || null;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Guarda el cambio de estado del pedido
   */
  async guardarCambioEstado() {
    if (!this.pedidoSeleccionado || !this.nuevoEstado) return;

    try {
      // Si el nuevo estado es "liberado", usar el método especial que libera los productos
      if (this.nuevoEstado === 'liberado') {
        const confirmacion = confirm(
          `¿Estás seguro de que deseas LIBERAR este pedido?\n\nEsto:\n- Marcará el pedido como LIBERADO\n- Liberará los productos (quedaran disponibles de nuevo)\n\n¿Continuar?`
        );
        if (!confirmacion) return;

        await this.pedidosService.liberarPedido(this.pedidoSeleccionado.id);
        this.cerrarModalEstado();
        this.notificacionService.mostrarExito('Pedido liberado correctamente. Los productos están disponibles de nuevo.');
        // Recargar pedidos para reflejar cambios
        this.cargarPedidos();
      } else {
        // Para otros estados, actualización normal
        const pedidoActualizado = { ...this.pedidoSeleccionado, estado: this.nuevoEstado as any };
        
        // Si el nuevo estado es "empacada" y hay foto nueva, subirla a Storage
        if (this.nuevoEstado === 'empacada' && this.fotoSeleccionada) {
          try {
            console.log('📤 Subiendo foto a Storage...');
            const urlFoto = await this.pedidosService.subirFotoPaquete(
              this.pedidoSeleccionado.id,
              this.fotoSeleccionada
            );
            pedidoActualizado.foto_paquete = urlFoto;
            console.log('✅ Foto subida correctamente a Storage:', urlFoto);
          } catch (error) {
            console.error('❌ Error subiendo foto:', error);
            this.notificacionService.mostrarError('Error al subir la foto. El estado se actualizará sin foto.');
          }
        }

        await this.pedidosService.actualizarPedido(pedidoActualizado);
        
        // Actualizar el pedido en la lista local para reflejar cambios inmediatamente
        const indexPedido = this.pedidos.findIndex(p => p.id === this.pedidoSeleccionado?.id);
        if (indexPedido !== -1) {
          this.pedidos[indexPedido] = { ...this.pedidos[indexPedido], ...pedidoActualizado };
        }
        
        this.cerrarModalEstado();
        this.notificacionService.mostrarExito('Guardado con éxito');
        
        // Recargar pedidos después de 1 segundo para sincronizar con Firebase
        setTimeout(() => {
          this.cargarPedidos();
        }, 1000);
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      this.notificacionService.mostrarError('Error al actualizar el estado');
    }
  }

  /**
   * Elimina un pedido con confirmación
   */
  async eliminarPedido(pedido: PedidoCompleto) {
    const confirmado = await this.modalService.confirmar({
      titulo: '⚠️ Eliminar Pedido',
      mensaje: `¿Estás seguro de que deseas eliminar el pedido para ${pedido.cliente_nombre}? Esta acción no se puede deshacer.`,
      textoBtnSi: 'Sí, eliminar',
      textoBtnNo: 'No, cancelar'
    });

    if (!confirmado) return;

    try {
      await this.pedidosService.eliminarPedido(pedido.id);
      this.notificacionService.mostrarExito('Pedido eliminado correctamente');
    } catch (error) {
      console.error('Error al eliminar pedido:', error);
      this.notificacionService.mostrarError('Error al eliminar el pedido');
    }
  }

  /**
   * Retorna el color de borde/fondo para el card del pedido según su estado
   */
  obtenerColorEstadoCard(estado: string): { borderColor: string; bgColor: string; headerColor: string } {
    const colores: { [key: string]: { borderColor: string; bgColor: string; headerColor: string } } = {
      'pendiente': { borderColor: 'border-yellow-600', bgColor: 'bg-yellow-50', headerColor: 'bg-yellow-500' },
      'empacada': { borderColor: 'border-pink-600', bgColor: 'bg-pink-50', headerColor: 'bg-pink-500' },
      'enviado': { borderColor: 'border-purple-800', bgColor: 'bg-purple-50', headerColor: 'bg-purple-900' },
      'retirado': { borderColor: 'border-green-700', bgColor: 'bg-green-50', headerColor: 'bg-green-600' },
      'no-retirado': { borderColor: 'border-orange-700', bgColor: 'bg-orange-50', headerColor: 'bg-orange-600' },
      'cancelado': { borderColor: 'border-red-900', bgColor: 'bg-red-50', headerColor: 'bg-red-800' },
      'retirado-local': { borderColor: 'border-gray-900', bgColor: 'bg-gray-50', headerColor: 'bg-gray-900' },
      'liberado': { borderColor: 'border-amber-900', bgColor: 'bg-amber-50', headerColor: 'bg-amber-800' },
      'remunero': { borderColor: 'border-teal-700', bgColor: 'bg-teal-50', headerColor: 'bg-teal-600' }
    };
    return colores[estado] || { borderColor: 'border-gray-700', bgColor: 'bg-gray-50', headerColor: 'bg-gray-700' };
  }

  /**
   * Retorna solo el color de borde para el card
   */
  obtenerBordeEstadoCard(estado: string): string {
    return this.obtenerColorEstadoCard(estado).borderColor;
  }

  /**
   * Retorna solo el color de fondo para el card body (clarito)
   */
  obtenerFondoEstadoCard(estado: string): string {
    return this.obtenerColorEstadoCard(estado).bgColor;
  }

  /**
   * Retorna el color del header del card (intenso oscuro)
   */
  obtenerHeaderEstadoCard(estado: string): string {
    return this.obtenerColorEstadoCard(estado).headerColor;
  }

  /**
   * Retorna las clases Tailwind para el gradient del modal según el estado
   */
  obtenerGradientModalEstado(estado: string): string {
    const gradientes: { [key: string]: string } = {
      'pendiente': 'from-yellow-600 to-yellow-700',
      'empacada': 'from-blue-600 to-blue-700',
      'enviado': 'from-purple-600 to-purple-700',
      'retirado': 'from-green-600 to-green-700',
      'no-retirado': 'from-orange-600 to-orange-700',
      'cancelado': 'from-red-600 to-red-700',
      'retirado-local': 'from-indigo-600 to-indigo-700',
      'liberado': 'from-pink-600 to-pink-700',
      'remunero': 'from-teal-600 to-teal-700'
    };
    return gradientes[estado] || 'from-gray-600 to-gray-700';
  }

  getEstadoBadgeColor(estado: string): string {
    const colors: { [key: string]: string } = {
      'pendiente': 'bg-yellow-100 text-yellow-800',
      'empacada': 'bg-blue-100 text-blue-800',
      'enviado': 'bg-purple-100 text-purple-800',
      'retirado': 'bg-green-100 text-green-800',
      'no-retirado': 'bg-orange-100 text-orange-800',
      'cancelado': 'bg-red-100 text-red-800',
      'retirado-local': 'bg-indigo-100 text-indigo-800',
      'liberado': 'bg-pink-100 text-pink-800',
      'remunero': 'bg-teal-100 text-teal-800'
    };
    return colors[estado] || 'bg-gray-100 text-gray-800';
  }

  getEstadoBadgeColorMobile(estado: string): string {
    const colors: { [key: string]: string } = {
      'pendiente': 'bg-yellow-500 text-white',
      'empacada': 'bg-blue-500 text-white',
      'enviado': 'bg-purple-500 text-white',
      'retirado': 'bg-green-500 text-white',
      'no-retirado': 'bg-orange-500 text-white',
      'cancelado': 'bg-red-500 text-white',
      'retirado-local': 'bg-indigo-500 text-white',
      'liberado': 'bg-pink-500 text-white',
      'remunero': 'bg-teal-500 text-white'
    };
    return colors[estado] || 'bg-gray-500 text-white';
  }

  formatearEstado(estado: string): string {
    const estados: { [key: string]: string } = {
      'todos': 'Todos',
      'urgentes-empacar': 'Urgentes de Empacar',
      'por-enviar': 'Por Enviar',
      'enviados': 'Enviados',
      'por-remunerar': 'Por Remunerar',
      'pendiente': 'Pendiente',
      'empacada': 'Empacada',
      'enviado': 'Enviado',
      'retirado': 'Retirado',
      'no-retirado': 'No Retirado',
      'cancelado': 'Cancelado (Pagado)',
      'retirado-local': 'Retirado del Local',
      'liberado': 'Liberado',
      'remunero': 'Remunerado'
    };
    return estados[estado] || estado;
  }

  /**
   * Obtiene el estado del pedido para mostrar: Pendiente, A punto, En Curso o Pasado
   * Solo se usa cuando filtro es 'por-retirar-hoy'
   */
  obtenerEstadoPedido(pedido: PedidoCompleto): string {
    const ahora = new Date();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes(); // En minutos

    if (!pedido.hora_inicio || !pedido.hora_fin) {
      return 'Pendiente';
    }

    // Convertir hora_inicio y hora_fin a minutos
    const [horaInicio, minInicio] = pedido.hora_inicio.split(':').map(Number);
    const [horaFin, minFin] = pedido.hora_fin.split(':').map(Number);
    
    const minutoInicio = horaInicio * 60 + minInicio;
    const minutoFin = horaFin * 60 + minFin;
    
    // 30 minutos antes de la hora de inicio = "A punto"
    const minutoAPunto = minutoInicio - 30;

    if (horaActual < minutoAPunto) {
      return 'Pendiente'; // ⏳
    } else if (horaActual < minutoInicio) {
      return 'A punto'; // ⏰
    } else if (horaActual < minutoFin) {
      return 'En Curso'; // ⚡
    } else {
      return 'Pasado'; // ✅
    }
  }

  /**
   * Obtiene el emoji/icono para cada estado
   */
  obtenerEmojiEstado(estado: string): string {
    const emojis: { [key: string]: string } = {
      'todos': '👁️',
      'urgentes-empacar': '🚨',
      'por-enviar': '📦',
      'enviados': '✈️',
      'por-remunerar': '💰',
      'pendiente': '🟡',
      'empacada': '📦',
      'enviado': '✈️',
      'retirado': '✅',
      'no-retirado': '❌',
      'cancelado': '💸',
      'retirado-local': '📍',
      'liberado': '🔓',
      'remunero': '💵'
    };
    return emojis[estado] || '•';
  }

  /**
   * Obtiene la etiqueta del día para el filtro de retiro (Hoy, Ayer, Anteayer, etc)
   */
  obtenerEtiquetaDia(diasAtras: number): string {
    switch(diasAtras) {
      case 0: return 'Hoy';
      case 1: return 'Ayer';
      case 2: return 'Anteayer';
      case 3: return 'Hace 3 días';
      case 4: return 'Hace 4 días';
      default: return `Hace ${diasAtras} días`;
    }
  }

  /**
   * Obtiene la fecha formateada para el filtro de retiro
   */
  obtenerFechaFiltroRetiro(diasAtras: number): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - diasAtras);
    return fecha.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  /**
   * Calcula el próximo día de envío (miércoles o sábado)
   */
  calcularProximoDiaEnvio(): Date {
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado

    let proximoEnvio = new Date(hoy);

    // Si hoy es domingo (0) a martes (2), el próximo envío es miércoles
    // Si hoy es miércoles (3) a viernes (5), el próximo envío es sábado
    // Si hoy es sábado (6), el próximo envío es el miércoles siguiente

    if (diaSemana === 0 || diaSemana === 1 || diaSemana === 2) {
      // Domingo, lunes, martes -> próximo miércoles (3)
      proximoEnvio.setDate(hoy.getDate() + (3 - diaSemana));
    } else if (diaSemana === 3) {
      // Si es miércoles, el próximo es sábado (en 3 días)
      proximoEnvio.setDate(hoy.getDate() + 3);
    } else if (diaSemana === 4 || diaSemana === 5) {
      // Jueves, viernes -> próximo sábado
      proximoEnvio.setDate(hoy.getDate() + (6 - diaSemana));
    } else if (diaSemana === 6) {
      // Sábado -> próximo miércoles (en 4 días)
      proximoEnvio.setDate(hoy.getDate() + 4);
    }

    return proximoEnvio;
  }

  /**
   * Verifica si un pedido debe empacarse con urgencia
   * (está en rango del próximo envío y está en pendiente o empacada)
   */
  debeEmpacarConUrgencia(pedido: PedidoCompleto): boolean {
    // Solo aplica si está en pendiente o empacada
    if (!['pendiente', 'empacada'].includes(pedido.estado)) {
      return false;
    }

    const proximoEnvio = this.calcularProximoDiaEnvio();
    const fechaEntrega = this.obtenerFechaEntrega(pedido.fecha_entrega_programada);

    // Comparar solo la fecha (sin hora)
    const fechaProxEnvio = new Date(proximoEnvio.getFullYear(), proximoEnvio.getMonth(), proximoEnvio.getDate());
    const fechaEntregaNormal = new Date(fechaEntrega.getFullYear(), fechaEntrega.getMonth(), fechaEntrega.getDate());

    // Calcular rango: desde proximoEnvio hasta 2 días antes del siguiente envío
    const finRango = new Date(fechaProxEnvio);
    finRango.setDate(finRango.getDate() + 2); // Rango de 3 días (ej: 14, 15, 16)

    return fechaEntregaNormal >= fechaProxEnvio && fechaEntregaNormal <= finRango;
  }

  /**
   * Obtiene estadísticas de pedidos
   */
  obtenerEstadisticas() {
    const stats = {
      total: this.pedidos.length,
      sinFinalizar: this.pedidos.filter(p => !['liberado', 'retirado-local', 'cancelado'].includes(p.estado)).length,
      pendientes: this.pedidos.filter(p => p.estado === 'pendiente').length,
      enviados: this.pedidos.filter(p => p.estado === 'enviado').length,
      retirados: this.pedidos.filter(p => p.estado === 'retirado').length,
      noRetirados: this.pedidos.filter(p => p.estado === 'no-retirado').length,
      liberados: this.pedidos.filter(p => p.estado === 'liberado').length,
      cancelados: this.pedidos.filter(p => p.estado === 'cancelado').length,
      retiradosLocal: this.pedidos.filter(p => p.estado === 'retirado-local').length,
      empacadas: this.pedidos.filter(p => p.estado === 'empacada').length
    };
    return stats;
  }

  /**
   * Obtiene pedidos sin finalizar (para búsqueda semanal)
   */
  obtenerPedidosSinFinalizar(): PedidoCompleto[] {
    const finalizados = ['liberado', 'retirado-local', 'cancelado'];
    return this.pedidos.filter(p => !finalizados.includes(p.estado));
  }

  /**
   * Abre preview de stickers con número de columnas especificado
   */
  abrirPreviewStickers(columnas: number = 2): void {
    // Abrir primero el selector de fecha
    this.abrirSelectorFechaEnvio();
  }

  /**
   * Maneja la descarga desde el modal de preview
   */
  manejarDescargarDesdePreview(evento: { pedidos: any[], todosPedidos: boolean }): void {
    try {
      console.log(`📥 Descargando ${evento.pedidos.length} stickers desde preview`);
      this.descargarStickersPdf(evento.pedidos);
      this.notificacionService.mostrarExito(`PDF generado con ${evento.pedidos.length} stickers`);
    } catch (error) {
      console.error('Error descargando PDF:', error);
      this.notificacionService.mostrarError('Error al generar el PDF');
    }
  }

  /**
   * Descarga stickers en PDF (método interno)
   */
  private descargarStickersPdf(pedidos: PedidoCompleto[]): void {
    this.stickerPdfService.generarPdfStickersBon(pedidos).then((blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fecha = new Date().toISOString().split('T')[0];
      link.download = `Stickers_Control_Eli_Gomez_${fecha}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  /**
   * Descarga stickers de pedidos pendientes filtrados por fecha
   */
  descargarStickersPorFecha(): void {
    try {
      // Filtrar solo pendientes
      let pendientes = this.pedidos.filter(p => p.estado === 'pendiente');

      // Aplicar filtros de fecha si existen
      if (this.filtroFechaDesde || this.filtroFechaHasta) {
        pendientes = pendientes.filter(p => {
          const fechaPedido = this.obtenerFechaEntrega(p.fecha_entrega_programada);
          
          if (this.filtroFechaDesde) {
            const desdeDate = new Date(this.filtroFechaDesde);
            if (fechaPedido < desdeDate) return false;
          }

          if (this.filtroFechaHasta) {
            const hastaDate = new Date(this.filtroFechaHasta);
            hastaDate.setDate(hastaDate.getDate() + 1);
            if (fechaPedido >= hastaDate) return false;
          }

          return true;
        });
      }

      if (pendientes.length === 0) {
        this.notificacionService.mostrarError('No hay pedidos pendientes para descargar');
        return;
      }

      // Guardar pendientes temporalmente y abrir selector de fecha
      this.pedidosParaPreview = pendientes as PedidoCompleto[];
      this.abrirSelectorFechaEnvio();
    } catch (error) {
      console.error('Error abriendo preview:', error);
      this.notificacionService.mostrarError('Error al abrir preview');
    }
  }




  /**
   * Calcula la próxima fecha de envío (miércoles o sábado)
   */
  calcularProximaFechaEnvio(): Date {
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado

    let proximaFecha = new Date(hoy);

    // Si es miércoles (3), devolver miércoles de hoy
    if (diaSemana === 3) {
      return proximaFecha;
    }

    // Si es sábado (6), devolver sábado de hoy
    if (diaSemana === 6) {
      return proximaFecha;
    }

    // Calcular días para el próximo miércoles o sábado
    let diasParaMiercoles: number;
    let diasParaSabado: number;

    if (diaSemana < 3) {
      // Lunes (1) o martes (2): miércoles es pronto
      diasParaMiercoles = 3 - diaSemana;
      diasParaSabado = 6 - diaSemana;
    } else if (diaSemana < 6) {
      // Miércoles (3) a viernes (5): próximo sábado es más cercano que próximo miércoles
      diasParaMiercoles = (7 - diaSemana) + 3; // próximo miércoles de la semana siguiente
      diasParaSabado = 6 - diaSemana;
    } else {
      // Domingo (0): próximo miércoles es en 3 días
      diasParaMiercoles = 3;
      diasParaSabado = 6;
    }

    // Elegir el más cercano
    const diasHastaProxima = diasParaMiercoles <= diasParaSabado ? diasParaMiercoles : diasParaSabado;
    proximaFecha.setDate(hoy.getDate() + diasHastaProxima);

    return proximaFecha;
  }

  /**
   * Abre el diálogo para seleccionar fecha de envío ANTES de preview
   */
  abrirSelectorFechaEnvio(): void {
    const proximaFecha = this.calcularProximaFechaEnvio();
    this.fechaTemporal = this.formatearFechaParaInput(proximaFecha);
    this.mostrarModalFechaEnvio = true;
  }

  /**
   * Formatea una fecha para el input type="date" (YYYY-MM-DD)
   */
  private formatearFechaParaInput(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Confirma la fecha seleccionada y abre el preview
   */
  confirmarFechaEnvio(): void {
    if (!this.fechaTemporal) {
      this.notificacionService.mostrarError('Por favor selecciona una fecha');
      return;
    }

    // Convertir string a Date
    const partes = this.fechaTemporal.split('-');
    this.fechaEnvio = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    
    // Cerrar modal de fecha
    this.mostrarModalFechaEnvio = false;

    // Si hay pedidos seleccionados, mostrar preview
    if (this.pedidosParaPreview && this.pedidosParaPreview.length > 0) {
      this.mostrarModalPreview = true;
    } else {
      // Si no hay pedidos pre-cargados, obtener los filtrados
      const pedidosFiltrados = this.getPedidosFiltrados();
      if (pedidosFiltrados.length === 0) {
        this.notificacionService.mostrarError('No hay pedidos para mostrar');
        return;
      }
      this.pedidosParaPreview = pedidosFiltrados;
      this.mostrarModalPreview = true;
    }

    console.log(`📋 Abriendo preview con ${this.pedidosParaPreview.length} stickers y fecha: ${this.fechaEnvio}`);
  }

  /**
   * Cancela la selección de fecha
   */
  cancelarFechaEnvio(): void {
    this.mostrarModalFechaEnvio = false;
    this.fechaTemporal = '';
    this.fechaEnvio = null;
  }

  /**
   * Abre preview de stickers con la fecha seleccionada
   */
  abrirPreviewStickersConFecha(): void {
    try {
      const pedidosFiltrados = this.getPedidosFiltrados();
      
      if (pedidosFiltrados.length === 0) {
        this.notificacionService.mostrarError('No hay pedidos para descargar');
        return;
      }

      console.log(`📋 Abriendo preview de ${pedidosFiltrados.length} stickers con fecha: ${this.fechaEnvio}`);
      this.pedidosParaPreview = pedidosFiltrados;
      this.mostrarModalPreview = true;
    } catch (error) {
      console.error('Error abriendo preview:', error);
      this.notificacionService.mostrarError('Error al abrir preview');
    }
  }

  /**
   * Alterna la selección de un pedido para generar stickers (máximo 8)
   */
  alternarSeleccionPedido(pedidoId: string): void {
    if (this.pedidosSeleccionados.has(pedidoId)) {
      this.pedidosSeleccionados.delete(pedidoId);
    } else {
      // Limitar a 8 pedidos máximo
      if (this.pedidosSeleccionados.size < 8) {
        this.pedidosSeleccionados.add(pedidoId);
      } else {
        this.notificacionService.mostrarError('Máximo permitido: 8 stickers. Deselecciona algunos pedidos para agregar nuevos.');
      }
    }
  }

  /**
   * Verifica si un pedido está seleccionado
   */
  estaPedidoSeleccionado(pedidoId: string): boolean {
    return this.pedidosSeleccionados.has(pedidoId);
  }

  /**
   * Verifica si un pedido está vencido (sin empacar y pasó su fecha de envío)
   */
  estaPedidoVencido(pedido: PedidoCompleto): boolean {
    // Solo si está en estado "pendiente" o similar (no empacado)
    if (!pedido.estado || ['empacada', 'enviado', 'liberado', 'retirado', 'cancelado'].includes(pedido.estado)) {
      return false;
    }

    // Obtener la fecha de entrega
    const fechaEntrega = this.obtenerFechaEntrega(pedido.fecha_entrega_programada);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    fechaEntrega.setHours(0, 0, 0, 0);

    // Si la fecha de entrega pasó y aún no está empacado
    return fechaEntrega < hoy;
  }

  /**
   * Verifica si un pedido debe estar destacado (atenuado con borde amarillo)
   * Basado en la fecha de entrega programada
   */
  obtenerClaseAtenuacionPedido(pedido: PedidoCompleto): boolean {
    const hoy = new Date();
    const diaHoy = hoy.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado

    // Obtener la fecha de entrega y su día
    const fechaEntrega = this.obtenerFechaEntrega(pedido.fecha_entrega_programada);
    const diaEntrega = fechaEntrega.getDay();

    // Si hoy es sábado (6), domingo (0), lunes (1) o martes (2):
    // Los pedidos para MIÉRCOLES (3) deben estar destacados
    if ([6, 0, 1, 2].includes(diaHoy) && diaEntrega === 3) {
      return true;
    }

    // Si hoy es miércoles (3), jueves (4) o viernes (5):
    // Los pedidos para SÁBADO (6) deben estar destacados
    if ([3, 4, 5].includes(diaHoy) && diaEntrega === 6) {
      return true;
    }

    return false;
  }

  /**
   * Cuenta los pedidos pendientes para envío de miércoles (miércoles, jueves, viernes)
   */
  contarPedidosMiercoles(): number {
    return this.pedidos.filter(p => {
      if (p.estado === 'cancelado') return false;
      const fechaEntrega = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      const diaEntrega = fechaEntrega.getDay();
      // Miércoles (3), Jueves (4), Viernes (5)
      return [3, 4, 5].includes(diaEntrega);
    }).length;
  }

  /**
   * Cuenta los pedidos pendientes para envío de sábado (sábado, domingo, lunes, martes)
   */
  contarPedidosSabado(): number {
    return this.pedidos.filter(p => {
      if (p.estado === 'cancelado') return false;
      const fechaEntrega = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      const diaEntrega = fechaEntrega.getDay();
      // Sábado (6), Domingo (0), Lunes (1), Martes (2)
      return [6, 0, 1, 2].includes(diaEntrega);
    }).length;
  }

  /**
   * Obtiene el texto del día de envío próximo según el día actual
   */
  obtenerTextoProximoEnvio(): { miercoles: string; sabado: string; fechaMiercoles: number; fechaSabado: number } {
    const hoy = new Date();
    const diaHoy = hoy.getDay();
    const diaActual = hoy.getDate();
    const mes = hoy.getMonth();
    const año = hoy.getFullYear();

    // Calcular próximo miércoles (3)
    let proximoMiercoles = new Date(año, mes, diaActual);
    const diasAlMiercoles = (3 - diaHoy + 7) % 7;
    proximoMiercoles.setDate(diaActual + (diasAlMiercoles === 0 && diaHoy !== 3 ? 7 : diasAlMiercoles));

    // Calcular próximo sábado (6)
    let proximoSabado = new Date(año, mes, diaActual);
    const diasAlSabado = (6 - diaHoy + 7) % 7;
    proximoSabado.setDate(diaActual + (diasAlSabado === 0 && diaHoy !== 6 ? 7 : diasAlSabado));

    const fechaMiercoles = proximoMiercoles.getDate();
    const fechaSabado = proximoSabado.getDate();

    if ([6, 0, 1, 2].includes(diaHoy)) {
      // Sábado, domingo, lunes o martes -> próximo es miércoles
      return {
        miercoles: `📅 Este Miércoles (${fechaMiercoles})`,
        sabado: `🔔 Próximo Sábado (${fechaSabado})`,
        fechaMiercoles,
        fechaSabado
      };
    } else {
      // Miércoles, jueves, viernes -> próximo es sábado
      return {
        miercoles: `🔔 Próximo Miércoles (${fechaMiercoles})`,
        sabado: `📅 Este Sábado (${fechaSabado})`,
        fechaMiercoles,
        fechaSabado
      };
    }
  }

  /**
   * Retorna el color óptimo para el texto basado en el color de fondo
   * Usa la misma lógica que en sticker-preview-modal
   */
  obtenerColorTexto(colorFondo: string | undefined, nombreTienda: string | undefined = ''): string {
    // Rosa de Eli Gomez (#ec4899) siempre usa blanco
    if (nombreTienda?.toLowerCase().includes('eli gomez') || colorFondo === '#ec4899') {
      return '#FFFFFF';
    }
    
    // Amarillo de Betty (#FFD700 o similar) siempre usa negro
    if (nombreTienda?.toLowerCase().includes('betty') || nombreTienda?.toLowerCase().includes('bettus')) {
      return '#000000';
    }
    
    if (!colorFondo) return '#000000';
    
    try {
      const hex = colorFondo.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      
      const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Si es color muy claro (luminancia > 0.55), usar negro para máximo contraste
      if (luminancia > 0.55) {
        return '#000000'; // Negro para colores pálidos/claros
      } else if (luminancia > 0.35) {
        // Color medio: usar versión más clara del mismo color
        const factor = 1.5;
        const r2 = Math.min(255, Math.floor(r * factor));
        const g2 = Math.min(255, Math.floor(g * factor));
        const b2 = Math.min(255, Math.floor(b * factor));
        return `#${r2.toString(16).padStart(2, '0')}${g2.toString(16).padStart(2, '0')}${b2.toString(16).padStart(2, '0')}`;
      } else {
        return '#ffffff'; // Blanco para fondos oscuros
      }
    } catch {
      return '#000000';
    }
  }

  /**
   * Determina si un pedido debe ser empacado (está pendiente de empacar para envío)
   * Retorna true si: NO está empacado, NO está cancelado Y su fecha de entrega corresponde al próximo envío
   */
  debeSerEmpacado(pedido: PedidoCompleto): boolean {
    // Si ya está empacado o cancelado, no necesita empacar
    if (pedido.estado === 'cancelado' || pedido.estado === 'empacada') return false;
    
    const fechaEntrega = this.obtenerFechaEntrega(pedido.fecha_entrega_programada);
    const diaEntrega = fechaEntrega.getDay();
    
    // Determinar si el próximo envío es miércoles o sábado
    const proximoEnvio = this.obtenerTextoProximoEnvio();
    const esMiercoles = proximoEnvio.miercoles.includes('Este');
    
    if (esMiercoles) {
      // Envío miércoles: incluye Miércoles (3), Jueves (4), Viernes (5)
      return [3, 4, 5].includes(diaEntrega);
    } else {
      // Envío sábado: incluye Sábado (6), Domingo (0), Lunes (1), Martes (2)
      return [6, 0, 1, 2].includes(diaEntrega);
    }
  }

  /**
   * Cuenta pedidos a empacar para envío de miércoles (no empacados)
   */
  contarPorEmpacarMiercoles(): number {
    const proximoEnvio = this.obtenerTextoProximoEnvio();
    const fechaTarget = proximoEnvio.fechaMiercoles;
    
    return this.pedidos.filter(p => {
      if (p.estado === 'cancelado' || p.estado === 'empacada') return false;
      const fechaEntrega = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      const diaEntrega = fechaEntrega.getDay();
      const fechaDiaEntrega = fechaEntrega.getDate();
      // Solo contar si es miércoles (3) Y tiene la fecha exacta del próximo envío
      return diaEntrega === 3 && fechaDiaEntrega === fechaTarget;
    }).length;
  }

  /**
   * Cuenta pedidos a empacar para envío de sábado (no empacados)
   */
  contarPorEmpacarSabado(): number {
    const proximoEnvio = this.obtenerTextoProximoEnvio();
    const fechaTarget = proximoEnvio.fechaSabado;
    
    return this.pedidos.filter(p => {
      if (p.estado === 'cancelado' || p.estado === 'empacada') return false;
      const fechaEntrega = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      const diaEntrega = fechaEntrega.getDay();
      const fechaDiaEntrega = fechaEntrega.getDate();
      // Solo contar si es sábado (6) Y tiene la fecha exacta del próximo envío
      return diaEntrega === 6 && fechaDiaEntrega === fechaTarget;
    }).length;
  }

  /**
   * Obtiene los pedidos que deben empacarse con urgencia (próximo envío, estado pendiente o reservado)
   */
  /**
   * Calcula la fecha límite para empacar con urgencia
   * Lógica SIMPLE:
   * 1. Si HOY es MIÉ(3) o SAB(6) → límite = HOY + 7
   * 2. Si NO es MIÉ ni SAB → retroceder hasta anterior MIÉ o SAB → límite = anterior + 7
   */
  calcularFechaLimiteUrgencia(): Date {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const diaHoy = hoy.getDay(); // 0=DOM, 1=LUN, 2=MAR, 3=MIÉ, 4=JUE, 5=VIE, 6=SAB
    const diasSemana = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SAB'];
    
    console.log(`\n🔍 [calcularFechaLimiteUrgencia] HOY: ${hoy.toISOString().split('T')[0]} (${diasSemana[diaHoy]})`);
    
    let fechaDiaEnvio: Date;
    
    // Paso 1: Determinar el día de envío actual o anterior
    if (diaHoy === 3 || diaHoy === 6) {
      // HOY es MIÉ o SAB → ese es el día de envío
      fechaDiaEnvio = new Date(hoy);
      console.log(`  → HOY es día de envío (${diaHoy === 3 ? 'MIÉ' : 'SAB'})`);
    } else {
      // Otro día: retroceder hasta encontrar anterior MIÉ o SAB
      fechaDiaEnvio = new Date(hoy);
      fechaDiaEnvio.setDate(hoy.getDate() - 1);
      
      while (true) {
        const dia = fechaDiaEnvio.getDay();
        if (dia === 3 || dia === 6) {
          // Encontrado
          console.log(`  → Buscando anterior: encontrado ${dia === 3 ? 'MIÉ' : 'SAB'} en ${fechaDiaEnvio.toISOString().split('T')[0]}`);
          break;
        }
        fechaDiaEnvio.setDate(fechaDiaEnvio.getDate() - 1);
      }
    }
    
    // Paso 2: Sumar 7 días al día de envío encontrado
    let fechaLimite = new Date(fechaDiaEnvio);
    fechaLimite.setDate(fechaDiaEnvio.getDate() + 7);
    
    console.log(`  → Fecha límite: ${fechaDiaEnvio.toISOString().split('T')[0]} + 7 = ${fechaLimite.toISOString().split('T')[0]}\n`);
    
    return fechaLimite;
  }

  /**
   * Obtiene pedidos con urgencia para empacar
   * Condición: estado PENDIENTE y fecha < fecha límite
   */
  obtenerPedidosUrgencia(): PedidoCompleto[] {
    const fechaLimite = this.calcularFechaLimiteUrgencia();
    
    return this.pedidos.filter(p => {
      // Solo PENDIENTE
      if (p.estado !== 'pendiente') {
        return false;
      }
      
      const fechaEntrega = this.obtenerFechaEntrega(p.fecha_entrega_programada);
      return fechaEntrega < fechaLimite;
    });
  }

  /**
   * Verifica si un pedido es urgente para empacar
   */
  esUrgente(pedido: PedidoCompleto): boolean {
    const estadoLower = pedido.estado?.toLowerCase() ?? '';
    console.log(`🔍 [esUrgente] ${pedido.cliente_nombre} - estado="${pedido.estado}" (toLowerCase="${estadoLower}")`);
    
    if (estadoLower !== 'pendiente') {
      console.log(`   ❌ No es pendiente`);
      return false;
    }
    
    const fechaLimite = this.calcularFechaLimiteUrgencia();
    const fechaEntrega = this.obtenerFechaEntrega(pedido.fecha_entrega_programada);
    const resultado = fechaEntrega < fechaLimite;
    
    console.log(`   ✅ Es pendiente: fecha=${fechaEntrega.toISOString().split('T')[0]} < límite=${fechaLimite.toISOString().split('T')[0]} = ${resultado}`);
    
    return resultado;
  }

  /**
   * Obtiene el estado de entrega de un pedido (a punto, en curso, pasado)
   * Solo para pedidos retirados HOY
   * Compara la hora actual con las horas de inicio y fin
   */
  obtenerEstadoEntrega(pedido: PedidoCompleto): { estado: string; emoji: string; color: string } {
    const ahora = new Date();
    const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
    
    const horaInicio = pedido.hora_inicio 
      ? parseInt(pedido.hora_inicio.split(':')[0]) * 60 + parseInt(pedido.hora_inicio.split(':')[1])
      : 0;
    
    const horaFin = pedido.hora_fin 
      ? parseInt(pedido.hora_fin.split(':')[0]) * 60 + parseInt(pedido.hora_fin.split(':')[1])
      : 1440;
    
    // A punto: si la entrega es en los próximos 30 minutos
    const estaPunto = horaActual >= (horaInicio - 30) && horaActual < horaInicio;
    
    // En curso: si estamos dentro del rango de horario
    const estaEnCurso = horaActual >= horaInicio && horaActual < horaFin;
    
    // Pasado: si pasó la hora fin
    const estaPasado = horaActual >= horaFin;
    
    if (estaPunto) {
      return { estado: 'a-punto', emoji: '⏰', color: 'bg-yellow-100 border-yellow-400' };
    } else if (estaEnCurso) {
      return { estado: 'en-curso', emoji: '⚡', color: 'bg-blue-100 border-blue-400' };
    } else if (estaPasado) {
      return { estado: 'pasado', emoji: '✅', color: 'bg-green-100 border-green-400' };
    } else {
      return { estado: 'pendiente', emoji: '⏳', color: 'bg-gray-100 border-gray-400' };
    }
  }

  /**
   * Abre el generador de stickers con pedidos seleccionados
   */
  abrirGeneradorStickers(): void {
    if (this.pedidosSeleccionados.size === 0) {
      this.notificacionService.mostrarError('Selecciona al menos 1 pedido');
      return;
    }

    // Obtener los pedidos seleccionados en orden
    const pedidosSeleccionadosArray = this.getPedidosFiltrados().filter(p => 
      this.pedidosSeleccionados.has(p.id!)
    );

    // Cerrar el modal de selector
    this.mostrarSelectorStickers = false;

    // Asignar los pedidos seleccionados
    this.pedidosParaPreview = pedidosSeleccionadosArray;

    // Abrir selector de fecha de envío
    this.abrirSelectorFechaEnvio();

    console.log(`📋 Abriendo preview con ${pedidosSeleccionadosArray.length} stickers seleccionados`);
  }

  /**
   * Limpia la selección de pedidos
   */
  limpiarSeleccion(): void {
    this.pedidosSeleccionados.clear();
  }

  /**
   * Selecciona el lote de urgentes especificado (primeros 8, segundos 8, etc)
   */
  seleccionarLoteUrgentes(numeroLote: number): void {
    const urgentes = this.obtenerPedidosUrgencia();
    const inicio = (numeroLote - 1) * 8;
    const fin = inicio + 8;
    const lotePedidos = urgentes.slice(inicio, fin);

    // Limpiar selección anterior
    this.pedidosSeleccionados.clear();

    // Seleccionar los pedidos del lote
    lotePedidos.forEach(pedido => {
      if (pedido.id) {
        this.pedidosSeleccionados.add(pedido.id);
      }
    });

    console.log(`✅ Seleccionados ${lotePedidos.length} pedidos del lote ${numeroLote}`);
  }

  /**
   * Obtiene los lotes disponibles de urgentes (divide en grupos de 8)
   */
  obtenerLotesDisponibles(): number {
    const urgentes = this.obtenerPedidosUrgencia();
    return Math.ceil(urgentes.length / 8);
  }

  /**
   * Abre el modal para seleccionar pedidos para stickers
   */
  abrirSelectorStickers(): void {
    this.mostrarSelectorStickers = true;
  }

  /**
   * Cierra el modal de selector de stickers
   */
  cerrarSelectorStickers(): void {
    this.mostrarSelectorStickers = false;
  }

  /**
   * Obtiene un color distintivo para cada perfil/nombre_perfil
   */
  obtenerColorPerfil(nombrePerfil: string): string {
    // 50 colores OSCUROS para excelente contraste con texto BLANCO
    const coloresDisponibles = [
      '#1A237E', // 1. Azul marino profundo
      '#0D47A1', // 2. Azul noche
      '#1B5E20', // 3. Verde bosque oscuro
      '#2E7D32', // 4. Verde oscuro
      '#27AE60', // 5. Verde esmeralda
      '#1565C0', // 6. Azul profundo
      '#0288D1', // 7. Azul cielo oscuro
      '#00796B', // 8. Teal oscuro
      '#004D40', // 9. Verde azulado oscuro
      '#1A237E', // 10. Índigo profundo
      '#512DA8', // 11. Púrpura profundo
      '#6A1B9A', // 12. Púrpura oscuro
      '#7B1FA2', // 13. Púrpura más profundo
      '#880E4F', // 14. Rosa profundo
      '#AD1457', // 15. Rosa rojo oscuro
      '#B71C1C', // 16. Rojo oscuro
      '#C41C3B', // 17. Rojo vino
      '#D32F2F', // 18. Rojo profundo
      '#F57F17', // 19. Naranja oscuro
      '#E65100', // 20. Naranja rojo
      '#BF360C', // 21. Naranja profundo
      '#3F2C2C', // 22. Marrón oscuro
      '#4A235A', // 23. Púrpura marrón
      '#3E2723', // 24. Marrón muy oscuro
      '#212121', // 25. Negro carbón
      '#263238', // 26. Gris azulado oscuro
      '#37474F', // 27. Gris oscuro
      '#455A64', // 28. Gris azul
      '#546E7A', // 29. Gris azul claro (sigue siendo oscuro)
      '#1A1A1A', // 30. Negro absoluto
      '#0B3D2C', // 31. Verde profundo
      '#1E3A5F', // 32. Azul marino
      '#2D3436', // 33. Gris carbón
      '#1D1D30', // 34. Azul marino muy oscuro
      '#3D1429', // 35. Púrpura burgundy
      '#1F1B3C', // 36. Índigo oscuro
      '#1A4D4D', // 37. Teal profundo
      '#2D3E50', // 38. Azul gris profundo
      '#1B2631', // 39. Negro azulado
      '#0E3B43', // 40. Verde azul profundo
      '#1C2833', // 41. Negro carbón claro
      '#34495E', // 42. Pizarra oscura
      '#16A085', // 43. Verde turquesa oscuro
      '#27452B', // 44. Verde militar
      '#1A1F5E', // 45. Azul marino índigo
      '#4A0E0E', // 46. Rojo borgoña
      '#2C1B47', // 47. Púrpura oscuro real
      '#0D3B66', // 48. Azul océano
      '#1A3A3A', // 49. Teal militar
      '#1C1A1A'  // 50. Negro gráfito
    ];

    // Generar un índice basado en el hash del nombre del perfil
    let hash = 0;
    for (let i = 0; i < nombrePerfil.length; i++) {
      hash = ((hash << 5) - hash) + nombrePerfil.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    const indice = Math.abs(hash) % coloresDisponibles.length;
    
    // Retornar solo el color de fondo hex (para usar en ngStyle)
    return coloresDisponibles[indice];
  }

  /**
   * Obtiene el color de texto para un perfil específico - Optimizado para legibilidad
   */
  obtenerColorTextoPerfil(nombrePerfil: string): string {
    // Todos los colores de fondo ahora son OSCUROS, por lo que SIEMPRE usamos BLANCO
    return '#FFFFFF'; // BLANCO para todos - excelente contraste con los colores oscuros
  }

  /**
   * Genera un QR en base64 para mostrar
   */
  generarQR(codigo: string | undefined): string {
    if (!codigo) return '';
    // Retorna una URL de servicio QR online para simplificar
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(codigo)}`;
  }

  /**
   * Abre modal para cargar imagen de paquete
   */
  abrirModalCargarImagen(pedido: PedidoCompleto): void {
    this.pedidoParaCargarImagen = pedido;
    this.mostrarModalCargarImagen = true;
    this.imagenPaqueteBase64 = null;
    this.imagenPaquetePreview = null;
  }

  /**
   * Cierra modal de cargar imagen
   */
  cerrarModalCargarImagen(): void {
    this.mostrarModalCargarImagen = false;
    this.pedidoParaCargarImagen = null;
    this.imagenPaqueteBase64 = null;
    this.imagenPaquetePreview = null;
  }

  /**
   * Maneja la selección de imagen de paquete
   */
  onImagenPaqueteSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        this.imagenPaqueteBase64 = result;
        this.imagenPaquetePreview = result;
      }
    };

    reader.readAsDataURL(file);
  }

  /**
   * Guarda la imagen del paquete
   */
  async guardarImagenPaquete(): Promise<void> {
    if (!this.pedidoParaCargarImagen || !this.imagenPaqueteBase64) {
      this.notificacionService.mostrarError('Por favor selecciona una imagen');
      return;
    }

    try {
      // Actualizar el pedido con la imagen en base64
      const pedidoActualizado: any = {
        ...this.pedidoParaCargarImagen,
        foto_paquete: this.imagenPaqueteBase64 as string
      };

      await this.pedidosService.actualizarPedido(pedidoActualizado);
      this.notificacionService.mostrarExito('Guardado con éxito');
      this.cerrarModalCargarImagen();
      // Recargar pedidos
      this.cargarPedidos();
    } catch (error) {
      console.error('Error al guardar imagen:', error);
      this.notificacionService.mostrarError('Error al guardar la imagen');
    }
  }

  /**
   * Abre el modal de importación de Excel
   */
  abrirImportarExcel() {
    this.mostrarImportarExcel = true;
  }

  /**
   * Procesa los datos importados del Excel
   */
  async procesarDatosExcel(datos: any) {
    try {
      console.log('📊 Iniciando importación de datos...');
      console.log('Tipo de importación:', datos.tipo);
      console.log('Clientes:', datos.clientes.length);
      console.log('Encomendistas:', datos.encomendistas.length);
      console.log('Destinos:', datos.destinos.length);
      console.log('Pedidos:', datos.pedidos.length);

      // Si tipo es 'limpiar', eliminar todos los datos
      if (datos.tipo === 'limpiar') {
        console.log('🗑️ Limpiando toda la base de datos...');
        await this.limpiarDatos();
        this.notificacionService.mostrarExito('Guardado con éxito');
        return;
      }

      // Importar clientes
      if (datos.tipo === 'clientes' || !datos.tipo) {
        // Importar clientes
        for (const cliente of datos.clientes) {
          const clienteExistente = this.clientes.find(c => 
            this.normalizarNombre(c.nombre) === this.normalizarNombre(cliente.nombre)
          );
          if (!clienteExistente) {
            await this.clientesService.crearCliente(cliente.nombre, cliente.telefono, cliente.direccion);
          }
        }
      }

      if (datos.tipo === 'destinos' || !datos.tipo) {
        // Importar encomendistas con destinos
        for (const encomendista of datos.encomendistas) {
          const encomendistasExistente = this.encomendistas.find(e => 
            this.normalizarNombre(e.nombre) === this.normalizarNombre(encomendista.nombre)
          );
          if (!encomendistasExistente) {
            await this.encomendistasService.crearEncomendista(
              encomendista.nombre,
              encomendista.destinos || [],
              encomendista.telefono,
              encomendista.local
            );
          }
        }
      }

      if (datos.tipo === 'pedidos' || !datos.tipo) {
        // Cargar datos actualizados para buscar relaciones
        await this.cargarClientes();
        await this.cargarEncomendistas();
        
        // Importar pedidos
        for (const pedido of datos.pedidos) {
          try {
            // Buscar cliente con normalización de nombre
            const cliente = this.clientes.find(c => 
              this.normalizarNombre(c.nombre) === this.normalizarNombre(pedido.cliente_nombre || '')
            );
            
            // Buscar encomendista con normalización de nombre
            const encomendista = this.encomendistas.find(e => 
              this.normalizarNombre(e.nombre) === this.normalizarNombre(pedido.encomendista_nombre || '')
            );

            // Agregar IDs y horarios al pedido
            const pedidoCompleto = {
              ...pedido,
              cliente_id: cliente?.id || '',
              encomendista_id: encomendista?.id || '',
              destino_tienda: pedido.tienda || pedido.destino || '',
              horario: `${pedido.hora_inicio || ''} a ${pedido.hora_fin || ''}`.trim()
            };

            await this.pedidosService.crearPedido(pedidoCompleto);
          } catch (error) {
            console.error('Error creando pedido:', error);
          }
        }
      }

      // Recargar datos
      await this.cargarClientes();
      await this.cargarEncomendistas();
      await this.cargarPedidos();

      const mensaje = datos.tipo === 'clientes' ? `✅ Importación de clientes completada!\n👤 Clientes: ${datos.clientes.length}` :
                      datos.tipo === 'destinos' ? `✅ Importación de destinos completada!\n👥 Encomendistas: ${datos.encomendistas.length}\n📍 Destinos: ${datos.destinos.length}` :
                      datos.tipo === 'pedidos' ? `✅ Importación de pedidos completada!\n📦 Pedidos: ${datos.pedidos.length}` :
                      `✅ Importación completada!\n👤 Clientes: ${datos.clientes.length}\n👥 Encomendistas: ${datos.encomendistas.length}\n📍 Destinos: ${datos.destinos.length}\n📦 Pedidos: ${datos.pedidos.length}`;
      
      this.notificacionService.mostrarExito(mensaje);
    } catch (error) {
      console.error('Error importando datos:', error);
      this.notificacionService.mostrarError('Error al importar los datos. Revisa la consola para más detalles.');
    }
  }

  /**
   * Genera y copia el recordatorio personalizado para el cliente
   */
  copiarRecordatorio(pedido: PedidoCompleto) {
    // Generar el mensaje personalizado
    const nombreCliente = pedido.cliente_nombre || 'Estimada Cliente';
    const horarioInicio = pedido.hora_inicio || '10:00';
    const horarioFin = pedido.hora_fin || '15:00';
    
    // Convertir a formato 12h si es necesario
    const hora12Inicio = this.convertirHora12(horarioInicio);
    const hora12Fin = this.convertirHora12(horarioFin);
    
    const recordatorio = `Hola buen día bella ⛅ hoy le entregan su paquete 📦 me confirma cuando retire nena de ante mano gracias, Cualquier duda o consulta estamos ala orden
Recuerde que el horario para retirar su paquete es de ${hora12Inicio} a ${hora12Fin}`;

    // Copiar al portapapeles
    navigator.clipboard.writeText(recordatorio).then(() => {
      // Mostrar notificación de éxito
      this.notificacionService.mostrarExito('Recordatorio copiado al portapapeles');
    }).catch(err => {
      console.error('Error al copiar:', err);
      this.notificacionService.mostrarError('Error al copiar el recordatorio');
    });
  }

  /**
   * Normaliza un nombre para comparación (trim, toLowerCase, sin acentos)
   */
  private normalizarNombre(nombre: string): string {
    if (!nombre) return '';
    return nombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /**
   * Abre el modal de edición puntual
   */
  abrirModalEdicionPuntual(pedido: PedidoCompleto) {
    this.pedidoEnEdicion = pedido;
    
    // Determinar tipo de envío según el modo del pedido
    const tipoEnvio = pedido.modo === 'personalizado' ? 'personalizado' : 'normal';
    
    // Cargar fecha de entrega en formato correcto
    let fechaFormato = '';
    if (pedido.fecha_entrega_programada) {
      const fecha = new Date(pedido.fecha_entrega_programada);
      fechaFormato = fecha.toISOString().split('T')[0]; // Formato: YYYY-MM-DD
    }
    
    this.edicionForm = {
      tienda_id: pedido.tienda_id || '', // NUEVO: Cargar tienda guardada
      encomendista_id: pedido.encomendista_id || '',
      destino_id: pedido.destino_id || '',
      dia_entrega: pedido.dia_entrega || '',
      hora_inicio: pedido.hora_inicio || '',
      hora_fin: pedido.hora_fin || '',
      costo_prendas: pedido.costo_prendas || 0,
      monto_envio: pedido.monto_envio || 0,
      notas: pedido.notas || '',
      tipo_envio: tipoEnvio,
      direccion_personalizada: pedido.direccion_personalizada || ''
    };
    
    // Cargar la fecha de entrega seleccionada
    this.fechaSeleccionadaEdicion = fechaFormato;

    // Limpiar búsquedas
    this.nombreEncomendistaBusquedaEdicion = '';
    this.nombreDestinoBusquedaEdicion = '';
    this.encomendistaBuscadasEdicion = [];
    this.destinosBuscadosEdicion = [];
    this.diasProximosEdicion = [];
    this.fechasDisponiblesEdicion = [];
    this.fechasOffsetEdicion = 0;

    // Cargar destinos y días según el tipo de envío
    if (tipoEnvio === 'normal') {
      // En modo normal: cargar destinos si hay encomendista
      if (this.edicionForm.encomendista_id) {
        this.actualizarDestinosDisponiblesEdicion();
        this.cargarDiasDisponiblesEdicion();
      }
    } else {
      // En modo personalizado: cargar días genéricos (solo próximos 7 días)
      this.cargarDiasDisponiblesEdicion();
    }

    this.mostrarModalEdicionPuntual = true;
  }

  /**
   * Normaliza texto removiendo acentos para búsqueda
   */
  normalizarTexto(texto: string): string {
    return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /**
   * Obtiene el nombre de la encomendista seleccionada para edición
   */
  obtenerNombreEncomendistaBuscadaEdicion(): string {
    if (this.nombreEncomendistaBusquedaEdicion) {
      return this.nombreEncomendistaBusquedaEdicion;
    }
    const encomendista = this.encomendistas.find(e => e.id === this.edicionForm.encomendista_id);
    return encomendista ? encomendista.nombre : '';
  }

  /**
   * Obtiene el nombre del destino seleccionado para edición
   */
  obtenerNombreDestinoBuscadoEdicion(): string {
    if (this.nombreDestinoBusquedaEdicion) {
      return this.nombreDestinoBusquedaEdicion;
    }
    return this.edicionForm.destino_id || '';
  }

  /**
   * Obtiene el nombre de la tienda seleccionada para edición
   */
  obtenerNombreTiendaEdicion(): string {
    if (!this.edicionForm.tienda_id) {
      return 'Tienda seleccionada';
    }
    const tienda = this.tiendas.find(t => t.id === this.edicionForm.tienda_id);
    return tienda ? tienda.nombre_pagina : 'Tienda seleccionada';
  }

  /**
   * Cambia la tienda seleccionada en edición (actualiza tienda_id)
   */
  seleccionarTiendaEdicion() {
    // La tienda se actualiza automáticamente desde el select [(ngModel)]
    // Este método existe por simetría con crear-pedido.component.ts
    console.log('Tienda seleccionada en edición:', this.edicionForm.tienda_id);
  }

  /**
   * Cambia el tipo de envío (normal o personalizado)
   */
  cambiarTipoEnvioEdicion(tipoNuevo: 'normal' | 'personalizado') {
    this.edicionForm.tipo_envio = tipoNuevo;
    
    // Siempre limpiar día, fecha y horarios
    this.edicionForm.dia_entrega = '';
    this.fechaSeleccionadaEdicion = '';
    this.diasProximosEdicion = [];
    this.fechasDisponiblesEdicion = [];
    this.edicionForm.hora_inicio = '';
    this.edicionForm.hora_fin = '';
    
    if (tipoNuevo === 'personalizado') {
      // En personalizado, limpiar destino pero MANTENER encomendista como opcional
      this.edicionForm.destino_id = '';
      this.nombreDestinoBusquedaEdicion = '';
      this.destinosBuscadosEdicion = [];
      // NO limpiar encomendista ni dirección
    } else {
      // En normal, limpiar dirección
      this.edicionForm.direccion_personalizada = '';
    }
  }

  /**
   * Busca encomendistas por nombre en modal de edición
   */
  buscarEncomendistasEdicion(nombre: string) {
    this.nombreEncomendistaBusquedaEdicion = nombre;
    if (nombre.trim() === '') {
      this.encomendistaBuscadasEdicion = [];
      return;
    }

    const busquedaNormalizada = this.normalizarTexto(nombre);
    this.encomendistaBuscadasEdicion = this.encomendistas
      .filter(e => this.normalizarTexto(e.nombre).includes(busquedaNormalizada))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * Selecciona una encomendista en el modal de edición
   */
  seleccionarEncomendistaBuscadaEdicion(encomendista: Encomendista) {
    this.edicionForm.encomendista_id = encomendista.id;
    this.nombreEncomendistaBusquedaEdicion = encomendista.nombre;
    this.encomendistaBuscadasEdicion = [];
    
    // SOLO en modo NORMAL: limpiar destino, días y horarios
    // En PERSONALIZADO: mantener todos los campos (dirección, fechas, horarios ya están guardados)
    if (this.edicionForm.tipo_envio === 'normal') {
      this.edicionForm.destino_id = '';
      this.nombreDestinoBusquedaEdicion = '';
      this.destinosBuscadosEdicion = [];
      this.edicionForm.dia_entrega = '';
      this.fechaSeleccionadaEdicion = '';
      this.diasProximosEdicion = [];
      this.fechasDisponiblesEdicion = [];
      this.edicionForm.hora_inicio = '';
      this.edicionForm.hora_fin = '';
      this.actualizarDestinosDisponiblesEdicion();
    }
    // En personalizado, NO limpiar nada - todo ya está guardado
  }

  /**
   * Actualiza destinos disponibles según encomendista en edición
   */
  actualizarDestinosDisponiblesEdicion() {
    const encomendista = this.encomendistas.find(e => e.id === this.edicionForm.encomendista_id);
    if (encomendista && encomendista.destinos) {
      this.destinosDisponiblesEdicion = encomendista.destinos.sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      );
    } else {
      this.destinosDisponiblesEdicion = [];
    }
  }

  /**
   * Busca destinos por nombre en modal de edición
   */
  buscarDestinosEdicion(nombre: string) {
    this.nombreDestinoBusquedaEdicion = nombre;
    if (nombre.trim() === '') {
      this.destinosBuscadosEdicion = [];
      return;
    }

    const busquedaNormalizada = this.normalizarTexto(nombre);
    this.destinosBuscadosEdicion = this.destinosDisponiblesEdicion
      .filter(d => this.normalizarTexto(d.nombre).includes(busquedaNormalizada))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /**
   * Selecciona un destino en el modal de edición
   */
  seleccionarDestinoBuscadoEdicion(destino: DestinoEncomendista) {
    this.edicionForm.destino_id = destino.nombre;
    this.nombreDestinoBusquedaEdicion = destino.nombre;
    this.destinosBuscadosEdicion = [];
    
    // Limpiar día, fecha y horario cuando cambia de destino
    this.edicionForm.dia_entrega = '';
    this.fechaSeleccionadaEdicion = '';
    this.fechasDisponiblesEdicion = [];
    this.edicionForm.hora_inicio = '';
    this.edicionForm.hora_fin = '';
    
    // Cargar días disponibles para este destino
    this.cargarDiasDisponiblesEdicion();
  }

  /**
   * Carga los días disponibles para el destino seleccionado en edición
   */
  cargarDiasDisponiblesEdicion() {
    // Si es modo NORMAL: requiere encomendista Y destino
    if (this.edicionForm.tipo_envio === 'normal') {
      if (!this.edicionForm.encomendista_id || !this.edicionForm.destino_id) {
        this.diasProximosEdicion = [];
        this.edicionForm.dia_entrega = ''; // Limpiar día seleccionado
        this.edicionForm.hora_inicio = '';
        this.edicionForm.hora_fin = '';
        this.fechasDisponiblesEdicion = [];
        return;
      }

      const encomendista = this.encomendistas.find(e => e.id === this.edicionForm.encomendista_id);
      if (!encomendista || !encomendista.destinos) return;

      const destino = encomendista.destinos.find(d => d.nombre === this.edicionForm.destino_id);
      if (!destino || !destino.horarios) {
        this.diasProximosEdicion = [];
        this.edicionForm.dia_entrega = '';
        this.edicionForm.hora_inicio = '';
        this.edicionForm.hora_fin = '';
        this.fechasDisponiblesEdicion = [];
        return;
      }

      // Obtener todos los días únicos del destino
      const diasUnicos = new Set<string>();
      destino.horarios.forEach(h => {
        if (h.dias) {
          h.dias.forEach(dia => diasUnicos.add(dia));
        }
      });

      // Mapear días a sus horarios
      this.diasProximosEdicion = Array.from(diasUnicos).map(dia => ({
        dia,
        proximoHorario: destino.horarios?.find(h => h.dias?.includes(dia))
      }));

      // NO seleccionar automáticamente, limpiar todo
      this.edicionForm.dia_entrega = '';
      this.edicionForm.hora_inicio = '';
      this.edicionForm.hora_fin = '';
      this.fechasDisponiblesEdicion = [];
    } else {
      // Si es modo PERSONALIZADO: cargar los próximos 7 días genéricos (lunes a domingo)
      const diasGenerico = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      this.diasProximosEdicion = diasGenerico.map(dia => ({
        dia,
        proximoHorario: undefined
      }));
      
      // NO seleccionar automáticamente si el pedido ya tiene día guardado, mantenerlo
      if (!this.edicionForm.dia_entrega) {
        this.edicionForm.hora_inicio = '';
        this.edicionForm.hora_fin = '';
        this.fechasDisponiblesEdicion = [];
      }
    }
  }

  /**
   * Selecciona un día en la edición y carga las fechas próximas + horas
   */
  seleccionarDiaEdicion(dia: string) {
    this.edicionForm.dia_entrega = dia;
    
    // Cargar automáticamente las horas del día seleccionado
    const encomendista = this.encomendistas.find(e => e.id === this.edicionForm.encomendista_id);
    if (encomendista && encomendista.destinos) {
      const destino = encomendista.destinos.find(d => d.nombre === this.edicionForm.destino_id);
      if (destino && destino.horarios) {
        const horario = destino.horarios.find(h => h.dias?.includes(dia));
        if (horario) {
          this.edicionForm.hora_inicio = horario.hora_inicio || '';
          this.edicionForm.hora_fin = horario.hora_fin || '';
        }
      }
    }
    
    // Resetear offset y calcular fechas próximas del día seleccionado
    this.fechasOffsetEdicion = 0;
    this.calcularProximasFechasEdicion(dia);
  }

  /**
   * Calcula las próximas fechas para un día específico (INCLUYENDO PASADAS en edición)
   */
  calcularProximasFechasEdicion(nombreDia: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechas: { fecha: Date; fechaFormato: string }[] = [];
    let fechaActual = new Date(hoy);
    const cantidad = 6;
    const offset = this.fechasOffsetEdicion;

    // EN EDICIÓN: permitir ir hacia atrás también
    // offset negativo = fechas pasadas, offset positivo = fechas futuras
    fechaActual.setDate(fechaActual.getDate() + offset);

    while (fechas.length < cantidad) {
      const diaSemanaNombre = this.diasSemana[fechaActual.getDay()];
      if (diaSemanaNombre === nombreDia) {
        const mes = fechaActual.getMonth();
        const año = fechaActual.getFullYear();
        const dia = fechaActual.getDate();
        const nombreMes = [
          'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ][mes];
        
        fechas.push({
          fecha: new Date(fechaActual),
          fechaFormato: `${diaSemanaNombre} ${dia} de ${nombreMes} ${año}`
        });
      }
      fechaActual.setDate(fechaActual.getDate() + 1);
    }

    this.fechasDisponiblesEdicion = fechas;
  }

  /**
   * Selecciona una fecha específica en edición
   */
  seleccionarFechaEdicion(fechaObj: { fecha: Date; fechaFormato: string }) {
    // Guardar la fecha seleccionada para mostrar en UI
    this.fechaSeleccionadaEdicion = fechaObj.fechaFormato;
    
    // Guardar la fecha en formato YYYY-MM-DD para guardar en BD
    const anio = fechaObj.fecha.getFullYear();
    const mes = String(fechaObj.fecha.getMonth() + 1).padStart(2, '0');
    const diaNum = String(fechaObj.fecha.getDate()).padStart(2, '0');
    const fechaFormato = `${anio}-${mes}-${diaNum}`;
    
    // NO sobrescribir dia_entrega, usarlo como campo temporal para guardar la fecha
    // En guardarEdicionPuntual() se usará este valor
    this.edicionForm.dia_entrega = fechaFormato;
  }

  /**
   * Obtiene el nombre del día a partir de una fecha en formato YYYY-MM-DD
   */
  obtenerNombreDiaEdicion(fechaYYYYMMDD: string): string {
    if (!fechaYYYYMMDD) return 'Seleccionado';
    try {
      const [anio, mes, dia] = fechaYYYYMMDD.split('-');
      const fecha = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
      return this.diasSemana[fecha.getDay()];
    } catch (error) {
      return 'Seleccionado';
    }
  }

  /**
   * Navega adelante en las fechas
   */
  irAdelanteEdicion() {
    this.fechasOffsetEdicion += 6;
    if (this.edicionForm.dia_entrega) {
      this.calcularProximasFechasEdicion(this.edicionForm.dia_entrega);
    }
  }

  /**
   * Navega atrás en las fechas
   */
  irAtrasEdicion() {
    // EN EDICIÓN: permitir ir hacia atrás sin límite (para seleccionar fechas pasadas)
    this.fechasOffsetEdicion -= 6;
    if (this.edicionForm.dia_entrega) {
      this.calcularProximasFechasEdicion(this.edicionForm.dia_entrega);
    }
  }

  /**
   * Actualiza los destinos disponibles según la encomendista seleccionada
   */
  actualizarDestinosDisponibles() {
    const encomendista = this.encomendistas.find(e => e.id === this.edicionForm.encomendista_id);
    if (encomendista && encomendista.destinos) {
      this.destinosDisponiblesEdicion = encomendista.destinos.sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      );
      // Resetear destino si la encomendista cambió
      if (this.edicionForm.destino_id && !this.destinosDisponiblesEdicion.find(d => d.nombre === this.edicionForm.destino_id)) {
        this.edicionForm.destino_id = '';
      }
    } else {
      this.destinosDisponiblesEdicion = [];
      this.edicionForm.destino_id = '';
    }
  }

  /**
   * Cierra el modal de edición puntual
   */
  cerrarModalEdicionPuntual() {
    this.mostrarModalEdicionPuntual = false;
    this.pedidoEnEdicion = null;
    this.destinosDisponiblesEdicion = [];
    this.nombreEncomendistaBusquedaEdicion = '';
    this.nombreDestinoBusquedaEdicion = '';
    this.encomendistaBuscadasEdicion = [];
    this.destinosBuscadosEdicion = [];
    this.diasProximosEdicion = [];
    this.fechasDisponiblesEdicion = [];
    this.fechasOffsetEdicion = 0;
  }

  /**
   * Guarda los cambios en la edición puntual del pedido
   */
  async guardarEdicionPuntual() {
    if (!this.pedidoEnEdicion) return;

    // Validar según el tipo de envío
    if (this.edicionForm.tipo_envio === 'normal') {
      // Validaciones para envío normal
      if (!this.edicionForm.encomendista_id || this.edicionForm.encomendista_id.trim() === '') {
        this.notificacionService.mostrarError('Debe seleccionar una encomendista');
        return;
      }

      if (!this.edicionForm.destino_id || this.edicionForm.destino_id.trim() === '') {
        this.notificacionService.mostrarError('Debe seleccionar un destino');
        return;
      }
    } else {
      // Validaciones para envío personalizado
      if (!this.edicionForm.direccion_personalizada || this.edicionForm.direccion_personalizada.trim() === '') {
        this.notificacionService.mostrarError('Debe ingresar la dirección de entrega');
        return;
      }
    }

    // Validaciones comunes a ambos tipos
    if (!this.edicionForm.dia_entrega || this.edicionForm.dia_entrega.trim() === '') {
      this.notificacionService.mostrarError('Debe seleccionar un día de entrega');
      return;
    }

    if (!this.fechaSeleccionadaEdicion || this.fechaSeleccionadaEdicion.trim() === '') {
      this.notificacionService.mostrarError('Debe seleccionar una fecha específica');
      return;
    }

    // Para envío normal, validar horarios (deben ser requeridos desde el destino)
    if (this.edicionForm.tipo_envio === 'normal') {
      if (!this.edicionForm.hora_inicio || this.edicionForm.hora_inicio.trim() === '') {
        this.notificacionService.mostrarError('La hora de inicio no se ha cargado correctamente');
        return;
      }

      if (!this.edicionForm.hora_fin || this.edicionForm.hora_fin.trim() === '') {
        this.notificacionService.mostrarError('La hora de fin no se ha cargado correctamente');
        return;
      }
    }

    try {
      // Convertir la fecha YYYY-MM-DD al nombre del día (Lunes, Martes, etc.)
      const nombreDia = this.obtenerNombreDiaEdicion(this.edicionForm.dia_entrega);
      
      // ✅ CONVERTIR FECHA A STRING (YYYY-MM-DD) ANTES DE GUARDAR
      // extraemos el formato YYYY-MM-DD de fechaSeleccionadaEdicion
      let fechaEntregaString = '';
      if (this.fechaSeleccionadaEdicion) {
        // fechaSeleccionadaEdicion es una fecha en formato legible (ej: "Lunes 24 de Enero 2025")
        // Necesitamos extraer las fechas disponibles que calculamos
        const fechaObj = this.fechasDisponiblesEdicion.find(f => f.fechaFormato === this.fechaSeleccionadaEdicion);
        if (fechaObj) {
          const year = fechaObj.fecha.getFullYear();
          const month = String(fechaObj.fecha.getMonth() + 1).padStart(2, '0');
          const day = String(fechaObj.fecha.getDate()).padStart(2, '0');
          fechaEntregaString = `${year}-${month}-${day}`;
        }
      }
      
      const pedidoActualizado: Pedido = {
        ...this.pedidoEnEdicion,
        tienda_id: this.edicionForm.tienda_id, // NUEVO: Actualizar tienda_id si cambió
        dia_entrega: nombreDia, // Guardar solo el nombre del día, no la fecha
        fecha_entrega_programada: fechaEntregaString as any, // ✅ STRING YYYY-MM-DD, NO Date object
        costo_prendas: this.edicionForm.costo_prendas,
        monto_envio: this.edicionForm.monto_envio,
        total: this.edicionForm.costo_prendas + this.edicionForm.monto_envio,
        notas: this.edicionForm.notas
      };



      // Obtener encomendista seleccionada para extraer su nombre
      const encomendista = this.encomendistas.find(e => e.id === this.edicionForm.encomendista_id);
      const encomendistaNombre = encomendista?.nombre || '';
      
      // Obtener destino seleccionado para extraer su nombre (en modo normal)
      let destinoNombre = '';
      if (this.edicionForm.tipo_envio === 'normal' && this.edicionForm.destino_id && encomendista) {
        const destino = encomendista.destinos?.find(d => d.nombre === this.edicionForm.destino_id);
        destinoNombre = destino?.nombre || '';
      }

      // Obtener tienda para extraer color_sticker y logo (USAR this.edicionForm.tienda_id)
      const tienda = this.tiendas.find(t => t.id === this.edicionForm.tienda_id);
      const colorSticker = tienda?.color_sticker || '#ec4899';
      const logoTienda = tienda?.imagen_url || 'assets/images/logoeligomez.jpg';
      const nombreTienda = tienda?.nombre_tienda || tienda?.nombre_pagina || 'Eli Gomez';
      const nombrePerfil = tienda?.nombre_perfil || tienda?.nombre_perfil_reserva || '';

      console.log('%c📝 GUARDANDO PEDIDO CON ACTUALIZACIÓN COMPLETA:', 'color: blue; font-weight: bold');
      console.log('%cTipo:', this.edicionForm.tipo_envio);
      console.log('%cEncomendista ID:', pedidoActualizado.encomendista_id);
      console.log('%cEncomendista NOMBRE:', encomendistaNombre);
      console.log('%cDestino ID:', pedidoActualizado.destino_id);
      console.log('%cDestino NOMBRE:', destinoNombre);
      console.log('%cDirección:', pedidoActualizado.direccion_personalizada);
      console.log('%cColor Sticker:', colorSticker);

      // Guardar campos específicos según tipo de envío
      if (this.edicionForm.tipo_envio === 'normal') {
        // Envío normal: guardar encomendista_id y destino_id CON SUS NOMBRES
        pedidoActualizado.encomendista_id = this.edicionForm.encomendista_id;
        pedidoActualizado.encomendista_nombre = encomendistaNombre;
        pedidoActualizado.destino_id = this.edicionForm.destino_id;
        pedidoActualizado.destino_nombre = destinoNombre;
        pedidoActualizado.direccion_personalizada = ''; // NO guardar dirección en normal
        pedidoActualizado.hora_inicio = this.edicionForm.hora_inicio;
        pedidoActualizado.hora_fin = this.edicionForm.hora_fin;
      } else {
        // Envío personalizado: guardar dirección (y encomendista si está seleccionado)
        pedidoActualizado.encomendista_id = this.edicionForm.encomendista_id || '';
        pedidoActualizado.encomendista_nombre = encomendistaNombre;
        pedidoActualizado.destino_id = ''; // NO guardar destino en personalizado
        pedidoActualizado.destino_nombre = ''; // NO guardar nombre destino en personalizado
        pedidoActualizado.direccion_personalizada = this.edicionForm.direccion_personalizada;
        pedidoActualizado.hora_inicio = '';
        pedidoActualizado.hora_fin = '';
      }

      // Actualizar también los campos derivados de tienda (para coherencia visual)
      pedidoActualizado.color_sticker = colorSticker;
      pedidoActualizado.logo_tienda = logoTienda;
      pedidoActualizado.nombre_tienda = nombreTienda;
      pedidoActualizado.nombre_perfil = nombrePerfil;

      // Guardar en Firebase
      await this.pedidosService.actualizarPedido(pedidoActualizado);

      // Mostrar notificación
      this.notificacionService.mostrarExito('Pedido actualizado correctamente');

      // Cerrar modal y recargar
      this.cerrarModalEdicionPuntual();
      setTimeout(() => {
        this.cargarPedidos();
      }, 500);
    } catch (error) {
      console.error('Error al actualizar pedido:', error);
      this.notificacionService.mostrarError('Error al actualizar el pedido');
    }
  }

  async limpiarDatos() {
    try {
      console.log('🗑️ Eliminando pedidos...');
      for (const pedido of this.pedidos) {
        try {
          await this.pedidosService.eliminarPedido(pedido.id);
        } catch (e) {
          console.warn('No se pudo eliminar pedido:', pedido.id);
        }
      }

      console.log('🗑️ Eliminando encomendistas...');
      for (const encomendista of this.encomendistas) {
        try {
          await this.encomendistasService.eliminarEncomendista(encomendista.id);
        } catch (e) {
          console.warn('No se pudo eliminar encomendista:', encomendista.id);
        }
      }

      console.log('🗑️ Eliminando clientes...');
      for (const cliente of this.clientes) {
        try {
          await this.clientesService.eliminarCliente(cliente.id);
        } catch (e) {
          console.warn('No se pudo eliminar cliente:', cliente.id);
        }
      }

      console.log('✅ Datos limpiados exitosamente');
      this.pedidos = [];
      this.encomendistas = [];
      this.clientes = [];
    } catch (error) {
      console.error('Error limpiando datos:', error);
      throw error;
    }
  }

}
