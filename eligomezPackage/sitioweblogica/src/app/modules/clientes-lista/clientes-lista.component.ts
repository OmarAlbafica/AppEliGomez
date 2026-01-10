import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientesService, Cliente } from '../../service/clientes/clientes.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-clientes-lista',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mx-auto p-6">
      <h1 class="text-4xl font-bold mb-8">👥 Clientes</h1>

      <!-- Mensaje si no hay clientes -->
      <div *ngIf="clientes.length === 0" class="bg-yellow-100 border-2 border-yellow-300 rounded-lg p-6 text-center">
        <p class="text-xl text-yellow-900">📭 No hay clientes registrados aún</p>
        <p class="text-gray-600 mt-2">Crea un cliente en "Crear Pedido" para que aparezca aquí</p>
      </div>

      <!-- Tabla de clientes -->
      <div *ngIf="clientes.length > 0" class="bg-white rounded-lg shadow-md overflow-hidden">
        <table class="w-full">
          <thead class="bg-blue-600 text-white">
            <tr>
              <th class="px-6 py-3 text-left">Nombre</th>
              <th class="px-6 py-3 text-left">Teléfono</th>
              <th class="px-6 py-3 text-left">Dirección</th>
              <th class="px-6 py-3 text-center">Fecha Creación</th>
              <th class="px-6 py-3 text-center">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let cliente of clientes" class="border-b hover:bg-gray-50 transition">
              <td class="px-6 py-4 font-bold">{{ cliente.nombre }}</td>
              <td class="px-6 py-4">📞 {{ cliente.telefono }}</td>
              <td class="px-6 py-4 text-gray-600">{{ cliente.direccion || '-' }}</td>
              <td class="px-6 py-4 text-center text-sm text-gray-600">
                {{ cliente.fecha_creacion | date:'dd/MM/yyyy' }}
              </td>
              <td class="px-6 py-4 text-center">
                <span *ngIf="cliente.activo" class="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                  ✅ Activo
                </span>
                <span *ngIf="!cliente.activo" class="bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                  ❌ Inactivo
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Estadísticas -->
      <div *ngIf="clientes.length > 0" class="mt-6 bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
        <p class="text-lg font-bold">📊 Total: <span class="text-blue-600">{{ clientes.length }}</span> cliente(s)</p>
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
export class ClientesListaComponent implements OnInit, OnDestroy {
  clientes: Cliente[] = [];
  private subscriptions: Subscription[] = [];

  constructor(private clientesService: ClientesService) {}

  ngOnInit() {
    const sub = this.clientesService.cargarClientes().subscribe((clientes: Cliente[]) => {
      this.clientes = clientes;
    });
    this.subscriptions.push(sub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
