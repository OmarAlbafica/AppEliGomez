import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { FavoritosPedidosService, FavoritoPedido } from '../../service/favoritos/favoritos-pedidos.service';
import { ModalConfirmacionService } from '../../service/modal-confirmacion/modal-confirmacion.service';

@Component({
  selector: 'app-favoritos-pedidos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './favoritos-pedidos.component.html',
  styleUrls: ['./favoritos-pedidos.component.css']
})
export class FavoritosPedidosComponent implements OnInit {
  clientes: Cliente[] = [];
  favoritos: FavoritoPedido[] = [];
  clienteSeleccionado: Cliente | null = null;
  favoritosFiltrados: FavoritoPedido[] = [];
  cargando = false;
  mensaje: { tipo: 'éxito' | 'error'; texto: string } | null = null;

  constructor(
    private clientesService: ClientesService,
    private favoritosPedidosService: FavoritosPedidosService,
    private modalService: ModalConfirmacionService
  ) {}

  ngOnInit() {
    // Los clientes se cargarán desde crear-pedido
    this.cargarFavoritos();
  }

  async cargarClientes() {
    try {
      // Método no disponible - usar desde crear-pedido
      // this.clientes = await this.clientesService.obtenerClientes();
    } catch (error) {
      console.error('Error cargando clientes:', error);
    }
  }

  async cargarFavoritos() {
    try {
      this.cargando = true;
      this.favoritos = await this.favoritosPedidosService.obtenerTodosFavoritos();
      this.filtrarFavoritos();
    } catch (error) {
      console.error('Error cargando favoritos:', error);
    } finally {
      this.cargando = false;
    }
  }

  seleccionarCliente(cliente: Cliente | null) {
    this.clienteSeleccionado = cliente;
    this.filtrarFavoritos();
  }

  obtenerConteoFavoritos(clienteId: string): number {
    return this.favoritos.filter(f => f.cliente_id === clienteId).length;
  }

  filtrarFavoritos() {
    if (this.clienteSeleccionado) {
      this.favoritosFiltrados = this.favoritos.filter(
        f => f.cliente_id === this.clienteSeleccionado!.id
      );
    } else {
      this.favoritosFiltrados = this.favoritos;
    }
  }

  async eliminarFavorito(favorito: FavoritoPedido) {
    if (!favorito.id) return;

    const confirmado = await this.modalService.confirmar({
      titulo: '⚠️ Eliminar Favorito',
      mensaje: `¿Estás seguro de que deseas eliminar el favorito "${favorito.encomendista_nombre} → ${favorito.destino_nombre}"?`,
      textoBtnSi: 'Sí, eliminar',
      textoBtnNo: 'No, cancelar'
    });

    if (!confirmado) return;

    try {
      this.cargando = true;
      await this.favoritosPedidosService.eliminarFavorito(favorito.id);
      this.mensaje = { tipo: 'éxito', texto: '✅ Favorito eliminado' };
      await this.cargarFavoritos();
      setTimeout(() => this.mensaje = null, 3000);
    } catch (error) {
      console.error('Error eliminando favorito:', error);
      this.mensaje = { tipo: 'error', texto: '❌ Error al eliminar favorito' };
    } finally {
      this.cargando = false;
    }
  }

  irACrearPedido(favorito: FavoritoPedido) {
    // Redirigir a crear pedido con los datos del favorito pre-rellenados
    console.log('Crear pedido con favorito:', favorito);
    // TODO: Implementar navegación a crear pedido con datos pre-rellenados
  }
}
