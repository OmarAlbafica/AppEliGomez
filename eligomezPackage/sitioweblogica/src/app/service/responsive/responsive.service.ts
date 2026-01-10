import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, debounceTime, map, startWith } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ResponsiveService implements OnDestroy {
  private isMobile = new BehaviorSubject<boolean>(this.checkIfMobile());
  public isMobile$ = this.isMobile.asObservable();

  constructor() {
    // Escuchar cambios de tamaño de pantalla con mejor detección
    fromEvent(window, 'resize')
      .pipe(
        debounceTime(100),
        map(() => this.checkIfMobile()),
        startWith(this.checkIfMobile())
      )
      .subscribe(isMobile => {
        console.log('📱 Responsive Service - isMobile:', isMobile, 'Width:', window.innerWidth);
        this.isMobile.next(isMobile);
      });

    // También escuchar orientChange para dispositivos móviles
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(max-width: 767px)');
      mediaQuery.addEventListener('change', (e) => {
        console.log('📱 Media query change - isMobile:', e.matches);
        this.isMobile.next(e.matches);
      });
    }
  }

  /**
   * Verifica si el dispositivo es móvil
   * Móvil: pantalla < 768px (Tailwind breakpoint md)
   */
  private checkIfMobile(): boolean {
    const isMobile = window.innerWidth < 768;
    console.log('🔍 checkIfMobile():', isMobile, 'innerWidth:', window.innerWidth);
    return isMobile;
  }

  /**
   * Obtiene el valor actual de si es móvil
   */
  getIsMobile(): boolean {
    return this.isMobile.value;
  }

  ngOnDestroy() {
    // Cleanup si es necesario
  }
}
