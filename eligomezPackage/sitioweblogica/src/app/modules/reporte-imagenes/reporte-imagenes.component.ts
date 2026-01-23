import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PedidosService } from '../../service/pedidos/pedidos.service';
import { ProductosService, Producto } from '../../service/productos/productos.service';
import { ModalNotificacionService } from '../../service/modal-notificacion/modal-notificacion.service';
import { Subscription } from 'rxjs';

interface PedidoConFoto {
  id?: string;
  codigo_pedido?: string;
  estado?: string;
  foto_paquete?: string;
  fecha_creacion?: any;
  fecha_liberado?: any;
  cliente_nombre?: string;
  productos?: Producto[];  // Agregar productos enriquecidos
  [key: string]: any;
}

@Component({
  selector: 'app-reporte-imagenes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-imagenes.component.html',
  styleUrls: ['./reporte-imagenes.component.css']
})
export class ReporteImagenesComponent implements OnInit, OnDestroy {
  pedidosLiberados: PedidoConFoto[] = [];
  pedidosReservados: PedidoConFoto[] = [];
  
  cargando = true;
  isMobile = false;
  
  // Rango configurable en días
  diasRango: number = 10;  // Cambiar a 10 días por defecto
  fechaInicio: Date = new Date();
  fechaFin: Date = new Date();
  
  // Zoom
  mostrarZoom = false;
  imagenZoom: string = '';
  
  private subscriptions: Subscription[] = [];

  constructor(
    private pedidosService: PedidosService,
    private productosService: ProductosService,
    private notificacionService: ModalNotificacionService
  ) {
    this.actualizarRangoFechas();
  }

  actualizarRangoFechas() {
    // Calcular X días atrás según diasRango
    this.fechaInicio = new Date();
    this.fechaInicio.setDate(this.fechaInicio.getDate() - this.diasRango);
    this.fechaFin = new Date();
  }

  cambiarRango(dias: number) {
    this.diasRango = dias;
    this.actualizarRangoFechas();
    this.cargarReporte();
  }

  ngOnInit() {
    this.detectarDispositivo();
    window.addEventListener('resize', () => this.detectarDispositivo());
    this.cargarReporte();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    window.removeEventListener('resize', () => this.detectarDispositivo());
  }

  detectarDispositivo() {
    this.isMobile = window.innerWidth < 768;
  }

  cargarReporte() {
    this.cargando = true;
    
    // Primero cargar productos explícitamente, luego pedidos
    this.productosService.recargarProductos().then(() => {
      this.subscriptions.push(
        this.pedidosService.cargarPedidos().subscribe((pedidos: any[]) => {
          this.subscriptions.push(
            this.productosService.productos$.subscribe((productos: Producto[]) => {
              console.log('📊 Productos cargados:', productos.length);
              console.log('📊 Pedidos cargados:', pedidos.length);
              this.procesarPedidos(pedidos, productos);
              this.cargando = false;
            })
          );
        })
      );
    });
  }

  procesarPedidos(pedidos: any[], productos: Producto[]) {
    // ⚠️ IMPORTANTE: Comparar SOLO año/mes/día (sin hora ni zona horaria)
    const formatoFecha = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const hoyStr = formatoFecha(new Date());
    const inicioStr = formatoFecha(this.fechaInicio);

    this.pedidosLiberados = [];
    this.pedidosReservados = [];

    console.log('🔍 Procesando. Rango:', inicioStr, 'a', hoyStr, '(solo fecha, sin hora)');
    console.log('🔍 Productos disponibles:', productos.length);

    // ============================================
    // LIBERADOS: Buscar PRODUCTOS con fecha_liberado
    // (cuando se elimina un pedido, el producto queda con fecha_liberado)
    // ============================================
    const productosLiberados = productos.filter(producto => {
      if (!producto.fecha_liberado) return false;
      
      const fechaLib = this.obtenerFecha(producto.fecha_liberado);
      const fechaLibStr = formatoFecha(fechaLib);
      const enRango = fechaLibStr >= inicioStr && fechaLibStr <= hoyStr;
      
      console.log(`🔓 Producto ${producto.codigo}: fecha_liberado=${fechaLibStr}, enRango=${enRango}, reservado=${producto.reservado}`);
      
      // Solo productos liberados que NO están reservados actualmente
      return enRango && !producto.reservado;
    });

    if (productosLiberados.length > 0) {
      // Agrupar productos liberados como un "pedido virtual" para mostrar
      this.pedidosLiberados.push({
        id: 'productos-liberados',
        codigo_pedido: 'PRODUCTOS LIBERADOS',
        estado: 'liberado',
        productos: productosLiberados,
        fecha_cambio: new Date()
      });
      console.log(`✅ ${productosLiberados.length} productos LIBERADOS para agregar a Canvas`);
    }

    // ============================================
    // RESERVADOS: Buscar PEDIDOS activos
    // ============================================
    pedidos.forEach(pedido => {
      // Enriquecer con datos de productos
      const productosDelPedido = pedido.productos_id 
        ? productos.filter(p => pedido.productos_id.includes(p.id))
        : [];

      // Obtener fecha del pedido (fecha_creacion)
      const fechaCreacion = this.obtenerFecha(pedido.fecha_creacion);
      const fechaCreacionStr = formatoFecha(fechaCreacion);
      
      // RESERVADOS: usar fecha_creacion
      const enRango = fechaCreacionStr >= inicioStr && fechaCreacionStr <= hoyStr;
      
      console.log(`📦 Pedido ${pedido.codigo_pedido}: estado=${pedido.estado}, fecha=${fechaCreacionStr}, enRango=${enRango}, productos=${productosDelPedido.length}`);

      if (!enRango || productosDelPedido.length === 0) return;

      // RESERVADOS: pedidos activos = productos que deben SALIR de Canvas
      const estadosReservados = ['pendiente', 'empacada', 'enviado', 'retirado', 'no-retirado', 'retirado-local', 'reservado'];
      if (estadosReservados.includes(pedido.estado)) {
        this.pedidosReservados.push({
          ...pedido,
          productos: productosDelPedido,
          fecha_cambio: fechaCreacion
        });
        console.log(`✅ Agregado a RESERVADOS (eliminar de Canvas): ${pedido.codigo_pedido}`);
      }
    });

    console.log(`📊 Final: ${this.pedidosLiberados.length} grupos liberados, ${this.pedidosReservados.length} reservados`);

    // Ordenar por fecha más reciente primero
    this.pedidosLiberados.sort((a, b) => 
      new Date(b['fecha_cambio'] || 0).getTime() - new Date(a['fecha_cambio'] || 0).getTime()
    );
    this.pedidosReservados.sort((a, b) => 
      new Date(b['fecha_creacion'] || 0).getTime() - new Date(a['fecha_creacion'] || 0).getTime()
    );
  }

  obtenerFecha(fecha: any): Date {
    if (!fecha) return new Date();
    if (fecha instanceof Date) return fecha;
    if (fecha.toDate) return fecha.toDate();
    if (typeof fecha === 'number') return new Date(fecha);
    return new Date(fecha);
  }

  obtenerNombreCliente(cliente_id: string): string {
    return 'Cliente';
  }

  formatearFecha(fecha: any): string {
    const d = this.obtenerFecha(fecha);
    return d.toLocaleDateString('es-ES', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  }

  copiarAlPortapapeles(texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      this.notificacionService.mostrarExito('Copiado al portapapeles');
    });
  }

  descargarImagen(url: string, nombre: string | undefined) {
    const link = document.createElement('a');
    link.href = url;
    link.download = nombre || 'imagen';
    link.click();
  }

  abrirZoom(url: string) {
    console.log('🔍 Abriendo zoom con URL:', url);
    // Si es una URL de thumbnail, quitarle el ?thumb=true para obtener la imagen completa
    let urlCompleta = url;
    if (url && url.includes('?thumb=true')) {
      urlCompleta = url.replace('?thumb=true', '');
    }
    this.imagenZoom = urlCompleta;
    this.mostrarZoom = true;
    console.log('mostrarZoom:', this.mostrarZoom, 'imagenZoom:', this.imagenZoom);
  }

  cerrarZoom() {
    console.log('❌ Cerrando zoom');
    this.mostrarZoom = false;
    this.imagenZoom = '';
  }
}
