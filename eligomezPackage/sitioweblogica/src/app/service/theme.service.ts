import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private darkModeSubject = new BehaviorSubject<boolean>(this.getInitialTheme());
  public darkMode$: Observable<boolean> = this.darkModeSubject.asObservable();

  constructor() {
    this.applyTheme(this.darkModeSubject.value);
  }

  /**
   * Obtiene el tema inicial (localStorage o preferencia del sistema)
   */
  private getInitialTheme(): boolean {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return JSON.parse(saved);
    }
    // Preferencia del sistema operativo
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Obtiene el estado actual del dark mode
   */
  isDarkMode(): boolean {
    return this.darkModeSubject.value;
  }

  /**
   * Alterna entre dark mode y light mode
   */
  toggleDarkMode(): void {
    const newValue = !this.darkModeSubject.value;
    this.darkModeSubject.next(newValue);
    localStorage.setItem('darkMode', JSON.stringify(newValue));
    this.applyTheme(newValue);
  }

  /**
   * Establece el tema explícitamente
   */
  setDarkMode(isDark: boolean): void {
    this.darkModeSubject.next(isDark);
    localStorage.setItem('darkMode', JSON.stringify(isDark));
    this.applyTheme(isDark);
  }

  /**
   * Aplica el tema al elemento html
   */
  private applyTheme(isDark: boolean): void {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
