import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PedidosService, Pedido } from '../../service/pedidos/pedidos.service';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { EncomendistasService, Encomendista } from '../../service/encomendistas/encomendistas.service';
import { Subscription } from 'rxjs';

interface PedidoConFecha extends Pedido {
  fecha_real?: Date;
  cliente_nombre?: string;
  encomendista_nombre?: string;
}

@Component({
  selector: 'app-pedidos-lista',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mx-auto p-6">
      <h1 class="text-4xl font-bold mb-8">📦 Pedidos</h1>

      <!-- Mensaje si no hay pedidos -->
      <div *ngIf="pedidosAgrupados.length === 0" class="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-6 text-center">
        <p class="text-xl text-yellow-900">📭 No hay pedidos registrados aún</p>
        <p class="text-gray-600 mt-2">Crea un pedido en "Crear Pedido" para que aparezca aquí</p>
      </div>

      <!-- Pedidos agrupados por fecha -->
      <div *ngFor="let grupo of pedidosAgrupados" class="mb-8">
        <!-- Encabezado de fecha -->
        <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg p-4 mb-4 shadow-lg">
          <h2 class="text-2xl font-bold">
            📅 {{ grupo.fecha_label }}
          </h2>
          <p class="text-blue-100 text-sm mt-1">{{ grupo.pedidos.length }} pedido(s)</p>
        </div>

        <!-- Tarjetas de pedidos -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div *ngFor="let pedido of grupo.pedidos" 
               class="bg-white rounded-lg shadow-md border-l-4 border-blue-500 p-5 hover:shadow-lg transition">
            
            <!-- Cliente -->
            <div class="mb-3">
              <p class="text-xs font-bold text-gray-500 uppercase">Cliente</p>
              <p class="text-lg font-bold text-blue-900">{{ pedido.cliente_nombre }}</p>
              <p class="text-sm text-gray-600">📞 {{ obtenerTelefonoCliente(pedido.cliente_id) }}</p>
            </div>

            <!-- Destino y Encomendista -->
            <div class="grid grid-cols-2 gap-3 mb-3 pb-3 border-b">
              <div>
                <p class="text-xs font-bold text-gray-500 uppercase">Encomendista</p>
                <p class="text-sm font-bold text-gray-700">{{ pedido.encomendista_nombre }}</p>
              </div>
              <div>
                <p class="text-xs font-bold text-gray-500 uppercase">Destino</p>
                <p class="text-sm font-bold text-gray-700">{{ pedido.destino_id }}</p>
              </div>
            </div>

            <!-- Horario -->
            <div class="mb-3 pb-3 border-b">
              <p class="text-xs font-bold text-gray-500 uppercase">Horario de Entrega</p>
              <p class="text-sm text-gray-700">
                🕐 {{ pedido.hora_inicio || '-' }} - {{ pedido.hora_fin || '-' }}
              </p>
            </div>

            <!-- Detalles del pedido -->
            <div class="grid grid-cols-2 gap-3 mb-3 pb-3 border-b">
              <div>
                <p class="text-xs font-bold text-gray-500 uppercase">Prendas</p>
                <p class="text-lg font-bold text-orange-600">{{ pedido.cantidad_prendas }}</p>
              </div>
              <div>
                <p class="text-xs font-bold text-gray-500 uppercase">Monto Envío</p>
                <p class="text-lg font-bold text-green-600">\${{ pedido.monto_envio.toFixed(2) }}</p>
              </div>
            </div>

            <!-- Notas -->
            <div *ngIf="pedido.notas" class="mb-3 pb-3 border-b bg-yellow-50 p-2 rounded">
              <p class="text-xs font-bold text-gray-500 uppercase">Notas</p>
              <p class="text-sm text-gray-700">{{ pedido.notas }}</p>
            </div>

            <!-- Estado -->
            <div class="flex justify-between items-center">
              <p class="text-xs font-bold text-gray-500 uppercase">Estado</p>
              <span [ngClass]="getEstadoClase(pedido.estado)" class="px-3 py-1 rounded-full text-xs font-bold">
                {{ formatearEstado(pedido.estado) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Estadísticas generales -->
      <div *ngIf="pedidos.length > 0" class="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-6">
        <h3 class="text-xl font-bold mb-4">📊 Resumen</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-lg shadow">
            <p class="text-gray-600 text-sm font-bold uppercase">Total Pedidos</p>
            <p class="text-3xl font-bold text-blue-600">{{ pedidos.length }}</p>
          </div>
          <div class="bg-white p-4 rounded-lg shadow">
            <p class="text-gray-600 text-sm font-bold uppercase">Total Prendas</p>
            <p class="text-3xl font-bold text-orange-600">{{ totalPrendas }}</p>
          </div>
          <div class="bg-white p-4 rounded-lg shadow">
            <p class="text-gray-600 text-sm font-bold uppercase">Ingresos Envíos</p>
            <p class="text-3xl font-bold text-green-600">\${{ totalIngresos.toFixed(2) }}</p>
          </div>
          <div class="bg-white p-4 rounded-lg shadow">
            <p class="text-gray-600 text-sm font-bold uppercase">Próxima Entrega</p>
            <p class="text-xl font-bold text-purple-600">{{ proximaEntrega }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: #f5f5f5;
      min-height: 100vh;
    }
  `]
})
export class PedidosListaComponent implements OnInit, OnDestroy {
  pedidos: PedidoConFecha[] = [];
  clientes: Cliente[] = [];
  encomendistas: Encomendista[] = [];
  
  pedidosAgrupados: Array<{ fecha_label: string; pedidos: PedidoConFecha[] }> = [];
  
  totalPrendas = 0;
  totalIngresos = 0;
  proximaEntrega = '-';

  private subscriptions: Subscription[] = [];

  constructor(
    private pedidosService: PedidosService,
    private clientesService: ClientesService,
    private encomendistasService: EncomendistasService
  ) {}

  ngOnInit() {
    this.cargarPedidos();
    this.cargarClientes();
    this.cargarEncomendistas();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Carga pedidos
   */
  cargarPedidos() {
    const sub = this.pedidosService.cargarPedidos().subscribe((pedidos: Pedido[]) => {
      this.pedidos = pedidos.map(p => ({
        ...p,
        fecha_real: this.calcularFechaReal(p.dia_entrega)
      }));
      this.agruparPorFecha();
      this.calcularEstadisticas();
    });
    this.subscriptions.push(sub);
  }

  /**
   * Carga clientes
   */
  cargarClientes() {
    const sub = this.clientesService.cargarClientes().subscribe((clientes: Cliente[]) => {
      this.clientes = clientes;
      this.enriquecerPedidos();
    });
    this.subscriptions.push(sub);
  }

  /**
   * Carga encomendistas
   */
  cargarEncomendistas() {
    const sub = this.encomendistasService.cargarEncomendistas().subscribe((encomendistas: Encomendista[]) => {
      this.encomendistas = encomendistas;
      this.enriquecerPedidos();
    });
    this.subscriptions.push(sub);
  }

  /**
   * Enriquece los pedidos con nombres de cliente y encomendista
   */
  enriquecerPedidos() {
    this.pedidos = this.pedidos.map(p => ({
      ...p,
      cliente_nombre: this.clientes.find(c => c.id === p.cliente_id)?.nombre || 'Desconocido',
      encomendista_nombre: this.encomendistas.find(e => e.id === p.encomendista_id)?.nombre || 'Desconocido'
    }));
    this.agruparPorFecha();
  }

  /**
   * Calcula la fecha real basada en el día de la semana
   * Retorna el próximo día de esa semana desde hoy
   */
  calcularFechaReal(dia_semana: string): Date {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const diasSemana: { [key: string]: number } = {
      'Lunes': 1,
      'Martes': 2,
      'Miércoles': 3,
      'Jueves': 4,
      'Viernes': 5,
      'Sábado': 6,
      'Domingo': 0
    };

    const diaNumero = diasSemana[dia_semana];
    if (diaNumero === undefined) return hoy;

    let dias = (diaNumero - hoy.getDay()) % 7;
    if (dias <= 0) dias += 7;

    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + dias);
    return fecha;
  }

  /**
   * Agrupa pedidos por fecha de entrega
   */
  agruparPorFecha() {
    const grupos: { [key: string]: PedidoConFecha[] } = {};

    this.pedidos.forEach(pedido => {
      const fecha = pedido.fecha_real || new Date();
      const fechaStr = fecha.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!grupos[fechaStr]) {
        grupos[fechaStr] = [];
      }
      grupos[fechaStr].push(pedido);
    });

    // Convertir a array y ordenar
    this.pedidosAgrupados = Object.entries(grupos)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([fecha, pedidos]) => ({
        fecha_label: this.formatearFecha(new Date(fecha)),
        pedidos: pedidos
      }));
  }

  /**
   * Formatea una fecha como "Miércoles 24 de Diciembre 2025"
   */
  formatearFecha(fecha: Date): string {
    const opciones: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    };
    return fecha.toLocaleDateString('es-ES', opciones);
  }

  /**
   * Obtiene el teléfono del cliente
   */
  obtenerTelefonoCliente(cliente_id: string): string {
    return this.clientes.find(c => c.id === cliente_id)?.telefono || '-';
  }

  /**
   * Calcula estadísticas
   */
  calcularEstadisticas() {
    this.totalPrendas = this.pedidos.reduce((sum, p) => sum + p.cantidad_prendas, 0);
    this.totalIngresos = this.pedidos.reduce((sum, p) => sum + p.monto_envio, 0);

    // Próxima entrega
    if (this.pedidosAgrupados.length > 0) {
      this.proximaEntrega = this.pedidosAgrupados[0].fecha_label.split(' ')[0]; // Solo el día
    }
  }

  /**
   * Retorna la clase CSS según el estado
   */
  getEstadoClase(estado: string): string {
    const clases: { [key: string]: string } = {
      'pendiente': 'bg-yellow-200 text-yellow-800',
      'confirmado': 'bg-blue-200 text-blue-800',
      'en-entrega': 'bg-purple-200 text-purple-800',
      'entregado': 'bg-green-200 text-green-800',
      'cancelado': 'bg-red-200 text-red-800'
    };
    return clases[estado] || 'bg-gray-200 text-gray-800';
  }

  /**
   * Formatea el estado
   */
  formatearEstado(estado: string): string {
    const estados: { [key: string]: string } = {
      'pendiente': '⏳ Pendiente',
      'confirmado': '✅ Confirmado',
      'en-entrega': '🚚 En Entrega',
      'entregado': '✔️ Entregado',
      'cancelado': '❌ Cancelado'
    };
    return estados[estado] || estado;
  }
}
