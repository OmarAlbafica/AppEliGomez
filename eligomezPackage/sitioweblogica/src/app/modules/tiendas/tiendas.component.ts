import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TiendasService } from '../../service/tiendas/tiendas.service';
import { ModalConfirmacionService } from '../../service/modal-confirmacion/modal-confirmacion.service';
import { ModalNotificacionService } from '../../service/modal-notificacion/modal-notificacion.service';
import { Tienda } from '../../models/tienda.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tiendas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tiendas.component.html',
  styleUrls: ['./tiendas.component.css']
})
export class TiendasComponent implements OnInit, OnDestroy {
  tiendas: Tienda[] = [];
  mostrarModalNueva = false;
  mostrarModalEditar = false;
  mostrarModalCargarImagen = false;
  
  formularioNuevo: Tienda = this.inicializarFormulario();
  tiendasEditando: Tienda | null = null;
  archivoImagen: File | null = null;
  cargandoImagen = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private tiendasService: TiendasService,
    private modalService: ModalConfirmacionService,
    private notificacionService: ModalNotificacionService
  ) {}

  ngOnInit(): void {
    this.cargarTiendas();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  inicializarFormulario(): Tienda {
    return {
      nombre_pagina: '',
      nombre_perfil_reserva: '',
      imagen_url: '',
      color_sticker: '#FF6B6B',
      activa: true
    };
  }

  cargarTiendas(): void {
    const sub = this.tiendasService.cargarTiendas().subscribe({
      next: (tiendas: Tienda[]) => {
        this.tiendas = tiendas;
        console.log('✅ Tiendas cargadas:', tiendas);
      },
      error: (error) => {
        console.error('❌ Error cargando tiendas:', error);
        this.notificacionService.mostrarError('Error al cargar las tiendas');
      }
    });
    this.subscriptions.push(sub);
  }

  abrirModalNueva(): void {
    this.formularioNuevo = this.inicializarFormulario();
    this.mostrarModalNueva = true;
  }

  cerrarModalNueva(): void {
    this.mostrarModalNueva = false;
    this.formularioNuevo = this.inicializarFormulario();
  }

  abrirModalEditar(tienda: Tienda): void {
    this.tiendasEditando = { ...tienda };
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar(): void {
    this.mostrarModalEditar = false;
    this.tiendasEditando = null;
  }

  async crearTienda(): Promise<void> {
    if (!this.formularioNuevo.nombre_pagina?.trim()) {
      this.notificacionService.mostrarError('El nombre de la página es requerido');
      return;
    }

    if (!this.formularioNuevo.nombre_perfil_reserva?.trim()) {
      this.notificacionService.mostrarError('El nombre del perfil de reserva es requerido');
      return;
    }

    if (!this.formularioNuevo.color_sticker) {
      this.notificacionService.mostrarError('El color del sticker es requerido');
      return;
    }

    try {
      await this.tiendasService.crearTienda(this.formularioNuevo);
      console.log('✅ Tienda creada exitosamente');
      this.notificacionService.mostrarExito('Tienda creada exitosamente');
      this.cerrarModalNueva();
    } catch (error) {
      console.error('❌ Error creando tienda:', error);
      this.notificacionService.mostrarError('Error al crear la tienda');
    }
  }

  async guardarEdicion(): Promise<void> {
    if (!this.tiendasEditando) return;

    if (!this.tiendasEditando.nombre_pagina?.trim()) {
      this.notificacionService.mostrarError('El nombre de la página es requerido');
      return;
    }

    if (!this.tiendasEditando.nombre_perfil_reserva?.trim()) {
      this.notificacionService.mostrarError('El nombre del perfil de reserva es requerido');
      return;
    }

    if (!this.tiendasEditando.color_sticker) {
      this.notificacionService.mostrarError('El color del sticker es requerido');
      return;
    }

    try {
      await this.tiendasService.actualizarTienda(this.tiendasEditando.id!, this.tiendasEditando);
      console.log('✅ Tienda actualizada exitosamente');
      this.notificacionService.mostrarExito('Tienda actualizada exitosamente');
      this.cerrarModalEditar();
    } catch (error) {
      console.error('❌ Error actualizando tienda:', error);
      this.notificacionService.mostrarError('Error al actualizar la tienda');
    }
  }

  async eliminarTienda(tienda: Tienda): Promise<void> {
    const confirmado = await this.modalService.confirmar({
      titulo: '⚠️ Eliminar Tienda',
      mensaje: `¿Estás seguro de que deseas eliminar la tienda "${tienda.nombre_pagina}"? Esta acción no se puede deshacer.`,
      textoBtnSi: 'Sí, eliminar',
      textoBtnNo: 'No, cancelar'
    });

    if (!confirmado) return;

    try {
      await this.tiendasService.eliminarTienda(tienda.id!);
      console.log('✅ Tienda eliminada exitosamente');
      this.notificacionService.mostrarExito('Tienda eliminada exitosamente');
    } catch (error) {
      console.error('❌ Error eliminando tienda:', error);
      this.notificacionService.mostrarError('Error al eliminar la tienda');
    }
  }

  toggleActiva(tienda: Tienda): void {
    tienda.activa = !tienda.activa;
    this.tiendasService.actualizarTienda(tienda.id!, { activa: tienda.activa }).catch(error => {
      console.error('Error actualizando estado de tienda:', error);
    });
  }

  /**
   * Abre modal para cargar imagen de tienda
   */
  abrirModalCargarImagen(): void {
    this.mostrarModalCargarImagen = true;
    this.archivoImagen = null;
  }

  /**
   * Cierra modal de carga de imagen
   */
  cerrarModalCargarImagen(): void {
    this.mostrarModalCargarImagen = false;
    this.archivoImagen = null;
  }

  /**
   * Maneja la selección de archivo
   */
  onImagenSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.archivoImagen = input.files[0];
    }
  }

  /**
   * Carga la imagen a Firebase Storage y obtiene la URL
   */
  async cargarImagenAlFirebase(): Promise<void> {
    if (!this.archivoImagen) {
      this.notificacionService.mostrarError('Selecciona una imagen primero');
      return;
    }

    if (!this.formularioNuevo.nombre_pagina || !this.formularioNuevo.nombre_pagina.trim()) {
      this.notificacionService.mostrarError('Ingresa el nombre de la tienda primero');
      return;
    }

    this.cargandoImagen = true;

    try {
      // Usar el servicio de tiendas para cargar la imagen
      const url = await this.tiendasService.cargarImagenTienda(this.archivoImagen, this.formularioNuevo.nombre_pagina);
      this.formularioNuevo.imagen_url = url;
      
      this.notificacionService.mostrarExito('Imagen cargada exitosamente');
      this.cerrarModalCargarImagen();
    } catch (error) {
      console.error('Error cargando imagen:', error);
      this.notificacionService.mostrarError('Error al cargar la imagen');
    } finally {
      this.cargandoImagen = false;
    }
  }

  /**
   * Carga imagen para tienda en edición
   */
  async cargarImagenAlFirebaseEdicion(): Promise<void> {
    if (!this.archivoImagen) {
      this.notificacionService.mostrarError('Selecciona una imagen primero');
      return;
    }

    if (!this.tiendasEditando || !this.tiendasEditando.nombre_pagina) {
      this.notificacionService.mostrarError('Tienda no válida');
      return;
    }

    this.cargandoImagen = true;

    try {
      const url = await this.tiendasService.cargarImagenTienda(this.archivoImagen, this.tiendasEditando.nombre_pagina);
      this.tiendasEditando.imagen_url = url;
      
      this.notificacionService.mostrarExito('Imagen cargada exitosamente');
      this.cerrarModalCargarImagen();
    } catch (error) {
      console.error('Error cargando imagen:', error);
      this.notificacionService.mostrarError('Error al cargar la imagen');
    } finally {
      this.cargandoImagen = false;
    }
  }
}
