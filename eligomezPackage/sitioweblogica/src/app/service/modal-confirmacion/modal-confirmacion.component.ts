import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalConfirmacionService } from './modal-confirmacion.service';

@Component({
  selector: 'app-modal-confirmacion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-confirmacion.component.html',
  styleUrls: ['./modal-confirmacion.component.css']
})
export class ModalConfirmacionComponent {
  private modalService = inject(ModalConfirmacionService);

  mostrarModal$ = this.modalService.mostrarModal$;
  datosModal$ = this.modalService.datosModal$;

  aceptar() {
    this.modalService.aceptar();
  }

  rechazar() {
    this.modalService.rechazar();
  }
}
