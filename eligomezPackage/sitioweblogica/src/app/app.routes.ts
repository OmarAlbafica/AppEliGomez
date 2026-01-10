import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { MainComponent } from './main/main.component';
import { DashboardComponent } from './modules/dashboard/dashboard.component';
import { CrearPedidoComponent } from './modules/crear-pedido/crear-pedido.component';
import { ClientesComponent } from './modules/clientes/clientes.component';
import { ProductosComponent } from './modules/productos/productos.component';
import { EncomendistasComponent } from './modules/encomendistas/encomendistas.component';
import { PedidosComponent } from './modules/pedidos/pedidos.component';
import { DashboardPedidosComponent } from './modules/dashboard-pedidos/dashboard-pedidos.component';
import { ClientesListaComponent } from './modules/clientes-lista/clientes-lista.component';
import { PedidosListaComponent } from './modules/pedidos-lista/pedidos-lista.component';
import { TiendasComponent } from './modules/tiendas/tiendas.component';
import { FavoritosPedidosComponent } from './modules/favoritos/favoritos-pedidos.component';
import { SettingsComponent } from './modules/settings/settings.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  {
    path: 'main',
    component: MainComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'dashboard-pedidos', component: DashboardPedidosComponent },
      { path: 'crear-pedido', component: CrearPedidoComponent },
      { path: 'tiendas', component: TiendasComponent },
      { path: 'productos', component: ProductosComponent },
      { path: 'clientes', component: ClientesComponent },
      { path: 'clientes-lista', component: ClientesListaComponent },
      { path: 'destinos', component: ProductosComponent }, // Mantenemos para compatibilidad
      { path: 'encomendistas', component: EncomendistasComponent },
      { path: 'pedidos', component: PedidosComponent },
      { path: 'pedidos-lista', component: PedidosListaComponent },
      { path: 'favoritos', component: FavoritosPedidosComponent },
      { path: 'settings', component: SettingsComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];