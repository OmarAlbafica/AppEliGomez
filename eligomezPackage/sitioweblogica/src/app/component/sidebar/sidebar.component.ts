import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { StorageService } from '../../..//service/storage/storage.service';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
    imports: [CommonModule]
})
export class SidebarComponent implements OnInit, OnChanges {
  @Input() isAdmin: boolean = false;
  @Input() selectedView: string = 'cartilla';
  @Input() isSidebarCollapsed: boolean = false;
  @Output() selectViewEvent = new EventEmitter<string>();
  @Output() toggleSidebarEvent = new EventEmitter<void>();
  selectedMenuItem: string = '';
  menuConfig: any = { showBancos: false, showCentralConfig: true };
  items: Array<{ label: string; route: string; roles?: string[]; icon: string } > = [];

  constructor(private storageService: StorageService, private router: Router, private http: HttpClient) {
    // Escuchar cambios de ruta para actualizar el elemento seleccionado
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateSelectedMenuItem(event.url);
    });
  }

  ngOnInit() {
    this.loadMenuConfig();
    
    // Establecer el Dashboard como seleccionado por defecto
    this.updateSelectedMenuItem(this.router.url);

    // Escuchar cambios en localStorage
    window.addEventListener('storage', (e) => {
      if (e.key === 'menu-config') {
        this.loadMenuConfig();
      }
    });
  }

  loadMenuConfig() {
    // Primero intentar cargar desde localStorage
    const savedConfig = localStorage.getItem('menu-config');
    if (savedConfig) {
      this.menuConfig = JSON.parse(savedConfig);
      this.updateMenuItems();
    } else {
      // Si no hay configuración guardada, cargar desde el archivo
      this.http.get('/assets/menu-config.json').subscribe(config => {
        this.menuConfig = config;
        this.updateMenuItems();
      });
    }
  }

  updateMenuItems() {
    // Filtrar items basado en la configuración y el rol actual
    const allItems = [
      { label: 'Dashboard', route: '/main/home', roles: ['Admin','Operador','Lectura'], icon: '📊' },
      { label: 'Membresías', route: '/main/membresias', roles: ['Admin','Operador','Lectura'], icon: '👥' },
      ...(this.menuConfig.showReglasAcumulacion ? [{ label: 'Reglas de Acumulación', route: '/main/config/accumulation', roles: ['Admin','Operador','Lectura'], icon: '📈' }] : []),
      ...(this.menuConfig.showDobleAcumulacion ? [{ label: 'Doble Acumulación', route: '/main/config/double-promo', roles: ['Admin','Operador','Lectura'], icon: '⚡' }] : []),
      ...(this.menuConfig.showRedencion ? [{ label: 'Redención', route: '/main/config/redemption', roles: ['Admin','Operador','Lectura'], icon: '🎁' }] : []),
      ...(this.menuConfig.showVencimiento ? [{ label: 'Vencimiento', route: '/main/config/expiration', roles: ['Admin','Operador','Lectura'], icon: '⏰' }] : []),
      // { label: 'Usuarios', route: '/main/users', roles: ['Admin'], icon: '👤' }, // Oculto para todos
    ];
    // Filtrar por rol
  const userRole = this.isAdmin ? 'Admin' : (localStorage.getItem('role') || 'Operador');
    this.items = allItems.filter(item => !item.roles || item.roles.includes(userRole));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedView'] && changes['selectedView'].currentValue) {
      this.selectedMenuItem = changes['selectedView'].currentValue;
    }
  }

  updateSelectedMenuItem(url: string) {
    // Encontrar el item que coincide con la URL actual
    const matchedItem = this.items.find(item => url.startsWith(item.route));
    if (matchedItem) {
      this.selectedMenuItem = matchedItem.route;
    } else if (url === '/main' || url === '/main/') {
      // Si estamos en /main, seleccionar Dashboard
      this.selectedMenuItem = '/main/home';
    }
  }

  toggleSidebar() {
    this.toggleSidebarEvent.emit();
  }

  selectView(view: string) {
    this.selectedMenuItem = view;
    this.router.navigate([view]);
  }

  logout() {
    this.storageService.clear();
    this.router.navigate(['/']);
  }
}