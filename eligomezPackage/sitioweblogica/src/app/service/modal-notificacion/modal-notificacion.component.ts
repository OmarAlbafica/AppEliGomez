import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalNotificacionService } from './modal-notificacion.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-modal-notificacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-notificacion.component.html'
})
export class ModalNotificacionComponent implements OnInit {
  notificacion$: Observable<any>;

  constructor(private notificacionService: ModalNotificacionService) {
    this.notificacion$ = this.notificacionService.notificacion$;
  }

  ngOnInit() {}

  cerrar() {
    this.notificacionService.cerrar();
  }
}
