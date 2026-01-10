import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { UserListComponent } from '../user-list/user-list.component';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-main-content',
  standalone: true,
  imports: [UserListComponent, CommonModule],
  templateUrl: './main-content.component.html',
  styleUrls: ['./main-content.component.css']
})
export class MainContentComponent implements OnInit {
  @Input() isSidebarCollapsed: boolean = false;
  @Input() selectedView: string = 'users';
  @Output() selectedViewChange = new EventEmitter<string>();
  @Output() menuConfigChanged = new EventEmitter<any>();

  menuConfig: any = {
    showBancos: false,
    showCentralConfig: true,
    coordenadaMode: "tiendas",
    showReglasAcumulacion: true,
    showDobleAcumulacion: true,
    showRedencion: true,
    showVencimiento: true
  };

  constructor(private router: Router, private route: ActivatedRoute, private http: HttpClient) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['selectedView']) {
        this.selectedView = params['selectedView'];
        this.selectedViewChange.emit(this.selectedView);
      }
    });

    // Cargar configuración del menú
    this.loadMenuConfig();
  }

  loadMenuConfig() {
    this.http.get('/assets/menu-config.json').subscribe(
      (config: any) => {
        this.menuConfig = config;
      },
      (error) => {
        console.log('Error cargando configuración del menú:', error);
      }
    );
  }

  updateMenuConfig(field: string, event: any) {
    this.menuConfig[field] = event.target.checked;
  }

  saveMenuConfig() {
    // En un entorno real, esto se guardaría en un servidor
    // Por ahora, solo emitimos el evento para notificar al sidebar
    this.menuConfigChanged.emit(this.menuConfig);
    localStorage.setItem('menu-config', JSON.stringify(this.menuConfig));
    alert('Configuración guardada correctamente!');
  }

  navigateToCreateUser() {
    this.router.navigate(['/main/create-user']);
  }
}