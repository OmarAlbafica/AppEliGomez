import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModalConfirmacionComponent } from './service/modal-confirmacion/modal-confirmacion.component';
import { ModalNotificacionComponent } from './service/modal-notificacion/modal-notificacion.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ModalConfirmacionComponent, ModalNotificacionComponent],
  template: `
    <router-outlet></router-outlet>
    <app-modal-confirmacion></app-modal-confirmacion>
    <app-modal-notificacion></app-modal-notificacion>
  `
})
export class AppComponent {
  title = 'Sistema de Encomiendas';
}
