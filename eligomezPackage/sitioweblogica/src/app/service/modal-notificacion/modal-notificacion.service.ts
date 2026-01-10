import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notificacion {
  tipo: 'éxito' | 'error';
  titulo: string;
  mensaje: string;
  id?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalNotificacionService {
  private notificacionSubject = new BehaviorSubject<Notificacion | null>(null);
  public notificacion$ = this.notificacionSubject.asObservable();

  mostrar(tipo: 'éxito' | 'error', mensaje: string, titulo?: string) {
    const notificacion: Notificacion = {
      tipo,
      titulo: titulo || (tipo === 'éxito' ? '✅ Éxito' : '❌ Error'),
      mensaje,
      id: Date.now().toString()
    };
    this.notificacionSubject.next(notificacion);
  }

  mostrarExito(mensaje: string, titulo?: string) {
    this.mostrar('éxito', mensaje, titulo);
  }

  mostrarError(mensaje: string, titulo?: string) {
    this.mostrar('error', mensaje, titulo);
  }

  cerrar() {
    this.notificacionSubject.next(null);
  }
}
