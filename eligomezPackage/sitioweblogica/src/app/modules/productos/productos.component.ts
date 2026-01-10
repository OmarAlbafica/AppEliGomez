import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResponsiveService } from '../../service/responsive/responsive.service';
import { ProductosService, Producto } from '../../service/productos/productos.service';
import { ModalConfirmacionService } from '../../service/modal-confirmacion/modal-confirmacion.service';
import { ModalNotificacionService } from '../../service/modal-notificacion/modal-notificacion.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos.component.html',
  styleUrls: ['./productos.component.css']
})
export class ProductosComponent implements OnInit, OnDestroy {
  isMobile: boolean = false;
  productos: Producto[] = [];
  albums: string[] = [];
  
  // Filtros
  albumSeleccionado: string = 'todos';
  filtroReservado: string = 'todos'; // 'todos', 'disponibles', 'reservados'
  
  // Carga de imágenes
  mostrarCargaImagenes = false;
  archivosCargados: File[] = [];
  albumNombre: string = '';
  numeroInicio: number = 1;
  procesando = false;
  progreso = 0;
  
  // Eliminar álbum
  mostrarModalBorrar = false;
  albumABorrar: string | null = null;
  borrando = false;
  
  // Zoom de imágenes
  mostrarZoom = false;
  imagenZoom: string = '';
  
  // Mensajes
  mensaje: { tipo: 'éxito' | 'error'; texto: string } | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private productosService: ProductosService,
    private modalService: ModalConfirmacionService,
    private notificacionService: ModalNotificacionService,
    private responsiveService: ResponsiveService
  ) {}

  ngOnInit() {
    this.isMobile = this.responsiveService.getIsMobile();
    this.responsiveService.isMobile$.subscribe(val => this.isMobile = val);
    // Primero cargar los productos inicialmente
    const cargarSub = this.productosService.cargarProductos().subscribe(
      (productos: Producto[]) => {
        console.log('📷 [PRODUCTOS COMPONENT] Productos cargados inicialmente:', productos.length);
        this.albums = this.productosService.obtenerAlbums();
        
        // Seleccionar el último álbum por defecto
        if (this.albums.length > 0) {
          this.albumSeleccionado = this.albums[this.albums.length - 1];
        }
        
        // Filtrar solo disponibles por defecto
        this.filtroReservado = 'disponibles';
      }
    );
    this.subscriptions.push(cargarSub);
    
    // Luego suscribirse a cambios reactivos del BehaviorSubject
    const productosSub = this.productosService.productos$.subscribe(
      (productos: Producto[]) => {
        console.log('📷 [PRODUCTOS COMPONENT] Productos actualizados:', productos.length);
        console.log('Disponibles:', productos.filter(p => !p.reservado).length, 'Reservados:', productos.filter(p => p.reservado).length);
        this.productos = productos;
      }
    );
    this.subscriptions.push(productosSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  cargarProductos() {
    const sub = this.productosService.cargarProductos().subscribe(
      (productos: Producto[]) => {
        console.log('📷 [PRODUCTOS COMPONENT] Productos recargados:', productos.length);
      }
    );
    this.subscriptions.push(sub);
  }

  abrirCargaImagenes() {
    this.mostrarCargaImagenes = true;
    this.archivosCargados = [];
    this.albumNombre = '';
    this.numeroInicio = 1;
  }

  /**
   * Abre el modal de confirmación para borrar un álbum
   */
  abrirModalBorrarAlbum(album: string) {
    this.albumABorrar = album;
    this.mostrarModalBorrar = true;
  }

  /**
   * Cierra el modal de borrar sin hacer nada
   */
  cerrarModalBorrar() {
    this.mostrarModalBorrar = false;
    this.albumABorrar = null;
  }

  /**
   * Borra todos los productos de un álbum
   */
  async borrarAlbum() {
    if (!this.albumABorrar) return;

    const productosBorrados = this.productos.filter(p => p.album === this.albumABorrar).length;

    const confirmado = await this.modalService.confirmar({
      titulo: '⚠️ Eliminar Álbum',
      mensaje: `¿Estás seguro de que deseas eliminar el álbum "${this.albumABorrar}" con ${productosBorrados} producto(s)? Esta acción no se puede deshacer.`,
      textoBtnSi: 'Sí, eliminar',
      textoBtnNo: 'No, cancelar'
    });

    if (!confirmado) {
      this.cerrarModalBorrar();
      return;
    }

    this.borrando = true;

    try {
      // Eliminar todos los productos del álbum
      await this.productosService.borrarAlbum(this.albumABorrar);

      this.mostrarMensaje('éxito', `Álbum "${this.albumABorrar}" eliminado (${productosBorrados} imagen(es))`);
      this.mostrarModalBorrar = false;
      this.albumABorrar = null;

      // Recargar productos
      await this.productosService.recargarProductos();
      this.cargarProductos();
    } catch (error) {
      console.error('Error borrando álbum:', error);
      this.mostrarMensaje('error', 'Error al eliminar el álbum');
    } finally {
      this.borrando = false;
    }
  }

  /**
   * Cuenta cuántos productos tiene un álbum
   */
  contarProductosDelAlbum(albumNombre: string): number {
    return this.productos.filter(p => p.album === albumNombre).length;
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.archivosCargados = Array.from(input.files);
    }
  }

  async procesarCarga() {
    if (!this.albumNombre.trim()) {
      this.mostrarMensaje('error', 'Ingresa el nombre del álbum');
      return;
    }

    if (this.archivosCargados.length === 0) {
      this.mostrarMensaje('error', 'Selecciona al menos una imagen');
      return;
    }

    this.procesando = true;
    this.progreso = 0;

    try {
      const productos = await this.productosService.cargarImagenesLote(
        this.archivosCargados,
        this.albumNombre,
        this.numeroInicio
      );

      this.mostrarMensaje('éxito', `${productos.length} imagen(es) cargada(s) exitosamente`);
      this.mostrarCargaImagenes = false;
      this.archivosCargados = [];
      this.albumNombre = '';
      
      // Recargar datos desde Firestore
      console.log('Recargando productos...');
      await this.productosService.recargarProductos();
      console.log('Productos recargados');
      
      // Actualizar vista
      this.cargarProductos();
    } catch (error) {
      this.mostrarMensaje('error', 'Error cargando imágenes');
      console.error(error);
    } finally {
      this.procesando = false;
    }
  }

  getProductosFiltrados(): Producto[] {
    let filtrados = this.productos;
    
    // Filtrar por album
    if (this.albumSeleccionado !== 'todos') {
      filtrados = filtrados.filter(p => p.album === this.albumSeleccionado);
    }
    
    // Filtrar por reservado/disponible
    if (this.filtroReservado === 'reservados') {
      filtrados = filtrados.filter(p => p.reservado === true);
    } else if (this.filtroReservado === 'disponibles') {
      filtrados = filtrados.filter(p => p.reservado !== true);
    }
    
    return filtrados;
  }

  /**
   * Obtiene el texto de estado de un producto
   */
  obtenerEstadoProducto(producto: Producto): string {
    return producto.reservado ? '●RESERVADO' : '○ Disponible';
  }

  /**
   * Obtiene el color del badge de estado
   */
  obtenerColorEstado(producto: Producto): string {
    return producto.reservado 
      ? 'bg-red-100 text-red-800' 
      : 'bg-green-100 text-green-800';
  }

  /**
   * Cuenta productos disponibles
   */
  contarDisponibles(): number {
    return this.productos.filter(p => !p.reservado).length;
  }

  /**
   * Cuenta productos reservados
   */
  contarReservados(): number {
    return this.productos.filter(p => p.reservado).length;
  }

  abrirDetalle(producto: Producto) {
    // Abre la imagen en un modal de zoom
    this.imagenZoom = producto.url_imagen;
    this.mostrarZoom = true;
  }

  cerrarZoom() {
    this.mostrarZoom = false;
    this.imagenZoom = '';
  }

  copiarCodigo(codigo: string) {
    navigator.clipboard.writeText(codigo).then(() => {
      this.mostrarMensaje('éxito', `Código copiado: ${codigo}`);
    });
  }

  calcularCompressionPromedio(): number {
    if (this.productos.length === 0) return 0;
    const totalAhorrado = this.productos.reduce((sum, p) => sum + (p.tamaño_original - p.tamaño_comprimido), 0);
    return totalAhorrado / this.productos.length / 1024;
  }

  mostrarMensaje(tipo: 'éxito' | 'error', texto: string) {
    if (tipo === 'éxito') {
      this.notificacionService.mostrarExito(texto);
    } else {
      this.notificacionService.mostrarError(texto);
    }
  }
}
