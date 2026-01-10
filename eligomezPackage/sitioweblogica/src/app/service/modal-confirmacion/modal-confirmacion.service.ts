import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ConfirmacionModalData {
  titulo: string;
  mensaje: string;
  textoBtnSi?: string;
  textoBtnNo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalConfirmacionService {
  private mostrarModal = new BehaviorSubject<boolean>(false);
  private datosModal = new BehaviorSubject<ConfirmacionModalData>({
    titulo: '⚠️ Confirmación',
    mensaje: '¿Estás seguro?',
    textoBtnSi: 'Sí, eliminar',
    textoBtnNo: 'No, cancelar'
  });

  private resolucion = new BehaviorSubject<boolean | null>(null);

  mostrarModal$ = this.mostrarModal.asObservable();
  datosModal$ = this.datosModal.asObservable();
  resolucion$ = this.resolucion.asObservable();

  constructor() {}

  /**
   * Abre el modal y retorna una promesa con la respuesta del usuario
   */
  confirmar(data: ConfirmacionModalData): Promise<boolean> {
    return new Promise((resolve) => {
      this.datosModal.next({
        titulo: data.titulo,
        mensaje: data.mensaje,
        textoBtnSi: data.textoBtnSi || 'Sí, eliminar',
        textoBtnNo: data.textoBtnNo || 'No, cancelar'
      });

      this.mostrarModal.next(true);

      // Escuchar la respuesta una sola vez
      const subscription = this.resolucion$.subscribe((resultado) => {
        if (resultado !== null) {
          this.mostrarModal.next(false);
          subscription.unsubscribe();
          resolve(resultado);
          this.resolucion.next(null); // Resetear
        }
      });
    });
  }

  aceptar() {
    this.resolucion.next(true);
  }

  rechazar() {
    this.resolucion.next(false);
  }
}
