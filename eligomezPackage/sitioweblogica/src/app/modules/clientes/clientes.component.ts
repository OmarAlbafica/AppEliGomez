import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { PedidosService, Pedido } from '../../service/pedidos/pedidos.service';
import { ModalConfirmacionService } from '../../service/modal-confirmacion/modal-confirmacion.service';
import { ModalNotificacionService } from '../../service/modal-notificacion/modal-notificacion.service';
import { ResponsiveService } from '../../service/responsive/responsive.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clientes.component.html',
  styleUrls: ['./clientes.component.css']
})
export class ClientesComponent implements OnInit, OnDestroy {
  clientes: Cliente[] = [];
  clientesFiltrados: Cliente[] = [];
  pedidosDelCliente: Pedido[] = [];
  mostrarModalNuevoCliente = false;
  mostrarModalHistorial = false;
  clienteSeleccionado: Cliente | null = null;
  busqueda: string = '';
  isMobile = false;
  
  // Estadísticas del cliente
  estadisticasCliente = {
    ultimoPedidoMonto: '$0',
    ultimoPedidoFecha: '',
    ingresosTotales: '$0',
    totalPedidos: 0,
    pedidosPendientes: 0,
    pedidosNoRetirados: 0,
    pedidosEntregados: 0,
    frecuencia: '0/mes'
  };
  
  // Ordenamiento
  ordenarPor = 'nombre';
  ordenAscendente = true;
  
  nuevoCliente = {
    nombre: '',
    telefono: '',
    direccion: ''
  };
  private subscriptions: Subscription[] = [];

  constructor(
    private clientesService: ClientesService,
    private pedidosService: PedidosService,
    private modalService: ModalConfirmacionService,
    private responsiveService: ResponsiveService,
    private notificacionService: ModalNotificacionService
  ) {}

  ngOnInit() {
    // Detectar si es móvil
    this.isMobile = this.responsiveService.getIsMobile();
    
    // Suscribirse a cambios de tamaño
    const mobileChangeSub = this.responsiveService.isMobile$.subscribe(isMobile => {
      console.log('📱 Clientes - isMobile changed:', isMobile);
      this.isMobile = isMobile;
    });
    this.subscriptions.push(mobileChangeSub);
    
    // Recarga los clientes al iniciar el componente
    this.clientesService.recargarClientes().then(() => {
      const sub = this.clientesService.cargarClientes().subscribe((clientes: Cliente[]) => {
        console.log('Clientes actualizados:', clientes);
        this.clientes = clientes;
        this.filtrarClientes();
      });
      this.subscriptions.push(sub);
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Normaliza texto removiendo acentos para búsqueda insensible a diacríticos
   */
  private normalizarTexto(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Filtra clientes por búsqueda
   */
  filtrarClientes() {
    if (!this.busqueda.trim()) {
      this.clientesFiltrados = this.getClientesOrdenados();
      return;
    }

    const busquedaNormalizada = this.normalizarTexto(this.busqueda);
    const filtrados = this.clientes.filter(cliente => {
      const nombreNormalizado = this.normalizarTexto(cliente.nombre);
      const telefonoNormalizado = this.normalizarTexto(cliente.telefono || '');
      const direccionNormalizada = this.normalizarTexto(cliente.direccion || '');
      
      return (
        nombreNormalizado.includes(busquedaNormalizada) ||
        telefonoNormalizado.includes(busquedaNormalizada) ||
        direccionNormalizada.includes(busquedaNormalizada)
      );
    });

    // Aplicar ordenamiento a los filtrados
    filtrados.sort((a, b) => {
      const valorA = a.nombre.toLowerCase();
      const valorB = b.nombre.toLowerCase();
      
      if (this.ordenAscendente) {
        return valorA.localeCompare(valorB);
      } else {
        return valorB.localeCompare(valorA);
      }
    });

    this.clientesFiltrados = filtrados;
  }

  abrirModalNuevoCliente() {
    this.mostrarModalNuevoCliente = true;
    this.nuevoCliente = { nombre: '', telefono: '', direccion: '' };
  }

  crearCliente() {
    if (!this.nuevoCliente.nombre.trim()) {
      this.notificacionService.mostrarError('El nombre es obligatorio');
      return;
    }

    this.clientesService
      .crearCliente(
        this.nuevoCliente.nombre,
        this.nuevoCliente.telefono,
        this.nuevoCliente.direccion
      )
      .then(() => {
        this.mostrarModalNuevoCliente = false;
        this.nuevoCliente = { nombre: '', telefono: '', direccion: '' };
        this.notificacionService.mostrarExito('Cliente creado exitosamente');
      })
      .catch((error) => {
        console.error('Error:', error);
        this.notificacionService.mostrarError('Error creando cliente');
      });
  }

  editCliente(cliente: Cliente) {
    this.nuevoCliente = {
      nombre: cliente.nombre,
      telefono: cliente.telefono || '',
      direccion: cliente.direccion || ''
    };
    this.mostrarModalNuevoCliente = true;
  }

  async deleteCliente(cliente: Cliente) {
    const confirmado = await this.modalService.confirmar({
      titulo: '⚠️ Eliminar Cliente',
      mensaje: `¿Estás seguro de que deseas eliminar a ${cliente.nombre}? Esta acción no se puede deshacer.`,
      textoBtnSi: 'Sí, eliminar',
      textoBtnNo: 'No, cancelar'
    });

    if (!confirmado) return;

    try {
      await this.clientesService.eliminarCliente(cliente.id);
      this.notificacionService.mostrarExito('Cliente eliminado correctamente');
      this.filtrarClientes();
    } catch (error) {
      console.error('Error al eliminar cliente:', error);
      this.notificacionService.mostrarError('Error al eliminar el cliente');
    }
  }

  toggleOrdenamiento() {
    this.ordenAscendente = !this.ordenAscendente;
  }

  getClientesOrdenados(): Cliente[] {
    const sorted = [...this.clientes];
    sorted.sort((a, b) => {
      const valorA = a.nombre.toLowerCase();
      const valorB = b.nombre.toLowerCase();
      
      if (this.ordenAscendente) {
        return valorA.localeCompare(valorB);
      } else {
        return valorB.localeCompare(valorA);
      }
    });
    return sorted;
  }

  /**
   * Abre modal con historial y estadísticas del cliente
   */
  async abrirHistorial(cliente: Cliente) {
    this.clienteSeleccionado = cliente;
    
    // Cargar pedidos del cliente
    const sub = this.pedidosService.cargarPedidos().subscribe((pedidos: Pedido[]) => {
      const pedidosCliente = pedidos.filter((p: any) => p.cliente_id === cliente.id);
      this.pedidosDelCliente = pedidosCliente;
      
      // Calcular estadísticas
      let ingresosTotales = 0;
      let pedidosPendientes = 0;
      let pedidosNoRetirados = 0;
      let pedidosEntregados = 0;
      let ultimoPedidoMonto = '$0';
      let ultimoPedidoFecha = '';

      pedidosCliente.forEach((pedido: any) => {
        const monto = parseFloat(pedido.valor_total || '0');
        ingresosTotales += monto;

        // Contar por estado
        if (pedido.estado === 'pendiente' || pedido.estado === 'sin-finalizar') {
          pedidosPendientes++;
        }
        if (pedido.estado === 'no-retirado' || pedido.estado === 'reservado') {
          pedidosNoRetirados++;
        }
        if (pedido.estado === 'retirado' || pedido.estado === 'retirado-local' || pedido.estado === 'enviado') {
          pedidosEntregados++;
        }

        // Obtener último pedido
        const fechaPedido = new Date(pedido.fecha_creacion).getTime();
        const ultimaFecha = ultimoPedidoFecha ? new Date(ultimoPedidoFecha).getTime() : 0;
        if (fechaPedido > ultimaFecha) {
          ultimoPedidoMonto = `$${monto.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
          ultimoPedidoFecha = new Date(pedido.fecha_creacion).toLocaleDateString('es-CL');
        }
      });

      // Calcular frecuencia de pedidos (pedidos por mes)
      const ahora = new Date().getTime();
      const hace30Dias = ahora - (30 * 24 * 60 * 60 * 1000);
      const pedidosUltimoMes = pedidosCliente.filter((p: any) => {
        const fecha = new Date(p.fecha_creacion).getTime();
        return fecha > hace30Dias;
      }).length;

      this.estadisticasCliente = {
        ultimoPedidoMonto: ultimoPedidoMonto,
        ultimoPedidoFecha: ultimoPedidoFecha,
        ingresosTotales: `$${ingresosTotales.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`,
        totalPedidos: pedidosCliente.length,
        pedidosPendientes,
        pedidosNoRetirados,
        pedidosEntregados,
        frecuencia: `${pedidosUltimoMes}/mes`
      };

      this.mostrarModalHistorial = true;
    });

    this.subscriptions.push(sub);
  }
}