import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { AuthService } from '../service/auth/auth.service';
import { ResponsiveService } from '../service/responsive/responsive.service';
import { ThemeService } from '../service/theme.service';
import { UsuarioFirebase } from '../service/auth/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css'],
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink]
})
export class MainComponent implements OnInit, OnDestroy {
  isSidebarOpen: boolean = true;
  isSidebarCompact: boolean = false;
  isMobile: boolean = false;
  currentRoute: string = '';
  usuarioActual: UsuarioFirebase | null = null;
  isDarkMode: boolean = false;
  private subscriptions: Subscription[] = [];

  menuItems = [
    { label: 'Dashboard', icon: '📊', route: '/main/dashboard' },
    { label: 'Crear Pedido', icon: '📦', route: '/main/crear-pedido' },
    { label: 'Tiendas', icon: '🏪', route: '/main/tiendas' },
    { label: 'Productos', icon: '🖼️', route: '/main/productos' },
    { label: 'Clientes', icon: '👥', route: '/main/clientes' },
    { label: 'Encomendistas', icon: '🚚', route: '/main/encomendistas' },
    { label: 'Pedidos', icon: '📋', route: '/main/pedidos' },
    { label: 'Pedidos por Fecha', icon: '📅', route: '/main/pedidos-por-fecha' },
    { label: 'Envios por Encomienda', icon: '📮', route: '/main/envios-por-encomienda' },
    { label: 'Reporte Canvas', icon: '📸', route: '/main/reporte-imagenes' },
    { label: 'Favoritos', icon: '⭐', route: '/main/favoritos' },
    { label: 'Configuración', icon: '⚙️', route: '/main/settings' }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private responsiveService: ResponsiveService,
    private themeService: ThemeService
  ) {
    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
    });
  }

  ngOnInit() {
    // Detectar si es móvil
    const mobileSub = this.responsiveService.isMobile$.subscribe(isMobile => {
      this.isMobile = isMobile;
      console.log('📱 MainComponent - isMobile:', isMobile);
      // En móvil, cerrar sidebar por defecto
      if (isMobile) {
        this.isSidebarOpen = false;
      } else {
        this.isSidebarOpen = true;
      }
    });
    this.subscriptions.push(mobileSub);

    // Cargar tema
    const themeSub = this.themeService.darkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
    this.subscriptions.push(themeSub);

    // Obtener usuario actual
    const userSub = this.authService.obtenerUsuarioActual$().subscribe(usuario => {
      this.usuarioActual = usuario;
    });
    this.subscriptions.push(userSub);

    if (this.router.url === '/main' || this.router.url === '/main/') {
      this.router.navigate(['/main/dashboard']);
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleCompactSidebar() {
    this.isSidebarCompact = !this.isSidebarCompact;
  }

  cerrarSidebarAlNavegar() {
    if (this.isMobile) {
      this.isSidebarOpen = false;
    }
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/']);
  }

  toggleDarkMode() {
    this.themeService.toggleDarkMode();
  }
}