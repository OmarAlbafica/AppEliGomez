import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard-pedidos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
      <div class="container mx-auto px-6 py-16">
        <h1 class="text-5xl font-bold mb-4">📦 Centro de Pedidos</h1>
        <p class="text-xl text-blue-100">Gestiona tus pedidos y clientes de manera eficiente</p>
      </div>
    </div>

    <div class="container mx-auto px-6 py-12">
      <!-- Tarjetas de acceso rápido -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <!-- Crear Pedido -->
        <a routerLink="/crear-pedido" class="group">
          <div class="bg-gradient-to-br from-green-400 to-green-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transform hover:scale-105 transition cursor-pointer">
            <p class="text-4xl mb-2">📝</p>
            <h3 class="text-2xl font-bold mb-2">Crear Pedido</h3>
            <p class="text-green-100">Registra nuevos pedidos</p>
          </div>
        </a>

        <!-- Ver Pedidos -->
        <a routerLink="/pedidos-lista" class="group">
          <div class="bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transform hover:scale-105 transition cursor-pointer">
            <p class="text-4xl mb-2">📦</p>
            <h3 class="text-2xl font-bold mb-2">Ver Pedidos</h3>
            <p class="text-blue-100">Listado de todos los pedidos</p>
          </div>
        </a>

        <!-- Ver Clientes -->
        <a routerLink="/clientes-lista" class="group">
          <div class="bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transform hover:scale-105 transition cursor-pointer">
            <p class="text-4xl mb-2">👥</p>
            <h3 class="text-2xl font-bold mb-2">Ver Clientes</h3>
            <p class="text-purple-100">Listado de clientes registrados</p>
          </div>
        </a>
      </div>

      <!-- Información -->
      <div class="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 text-center">
        <p class="text-gray-700 text-lg">
          💡 <strong>Tip:</strong> Usa "Crear Pedido" para registrar nuevos pedidos. 
          Los pedidos se agruparán automáticamente por fecha de entrega.
        </p>
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
export class DashboardPedidosComponent {}
