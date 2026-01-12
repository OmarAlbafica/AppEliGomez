import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PedidosService } from '../../service/pedidos/pedidos.service';
import { ProductosService, Producto } from '../../service/productos/productos.service';
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
    private productosService: ProductosService
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
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const inicio = new Date(this.fechaInicio);
    inicio.setHours(0, 0, 0, 0);

    this.pedidosLiberados = [];
    this.pedidosReservados = [];

    console.log('🔍 Procesando pedidos. Rango:', inicio, 'a', hoy);
    console.log('🔍 Productos disponibles:', productos.length);

    pedidos.forEach(pedido => {
      // Enriquecer con datos de productos
      const productosDelPedido = pedido.productos_id 
        ? productos.filter(p => pedido.productos_id.includes(p.id))
        : [];

      console.log(`📦 Pedido ${pedido.codigo_pedido}:`, {
        productos_id: pedido.productos_id,
        encontrados: productosDelPedido.length,
        urls: productosDelPedido.map(p => ({ id: p.id, url: p.url_imagen }))
      });

      // LIBERADOS: buscar productos que tengan fecha_liberado en el rango
      if (productosDelPedido.length > 0) {
        // Filtrar solo los productos que están liberados (tienen fecha_liberado) en el rango
        const productosLiberados = productosDelPedido.filter(p => {
          if (!p.fecha_liberado) return false;
          const fecha = this.obtenerFecha(p.fecha_liberado);
          return fecha >= inicio && fecha <= hoy;
        });

        if (productosLiberados.length > 0) {
          this.pedidosLiberados.push({
            ...pedido,
            productos: productosLiberados,
            fecha_cambio: this.obtenerFecha(productosLiberados[0].fecha_liberado)
          });
          console.log(`✅ Agregado a LIBERADOS: ${pedido.codigo_pedido} con ${productosLiberados.length} productos liberados`);
          return;
        }
      }

      // RESERVADOS: todos los pedidos creados en el rango que tengan productos SIN fecha_liberado
      const fechaCreacion = this.obtenerFecha(pedido.fecha_creacion);
      
      // Verificar que:
      // 1. Está en el rango de fechas
      // 2. Tiene productos agregados que NO estén liberados
      if (fechaCreacion >= inicio && fechaCreacion <= hoy && productosDelPedido.length > 0) {
        // Filtrar productos que NO están liberados
        const productosNoLiberados = productosDelPedido.filter(p => !p.fecha_liberado);
        
        if (productosNoLiberados.length > 0) {
          this.pedidosReservados.push({
            ...pedido,
            productos: productosNoLiberados,
            fecha_cambio: fechaCreacion
          });
          console.log(`✅ Agregado a RESERVADOS: ${pedido.codigo_pedido} con ${productosNoLiberados.length} productos sin liberar`);
        }
      }
    });

    console.log(`📊 Final: ${this.pedidosLiberados.length} liberados, ${this.pedidosReservados.length} reservados`);

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
      alert('Copiado al portapapeles');
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
