import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root'
})
export class StorageService {

  private readonly TOKEN_KEY = 'auth_token';
  private readonly ADMIN_KEY = 'is_admin';
  private readonly TOKEN_EXP_KEY = 'auth_token_exp';
  private readonly ROLES_KEY = 'auth_roles';

  setToken(token: string, expiresInMinutes: number = 30): void {
    console.log('🔧 StorageService.setToken() - Storing token:', token.substring(0, 20) + '...');
    console.log('🔧 StorageService.setToken() - Expires in minutes:', expiresInMinutes);
    localStorage.setItem(this.TOKEN_KEY, token);
    // Guardar la fecha de expiración (en milisegundos)
    const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
    localStorage.setItem(this.TOKEN_EXP_KEY, expiresAt.toString());
    console.log('🔧 StorageService.setToken() - Token stored successfully');
  }

  getToken(): string | null {
    console.log('🔍 StorageService.getToken() - Retrieving token...');
    // Verificar si el token ha expirado
    const expiresAt = localStorage.getItem(this.TOKEN_EXP_KEY);
    const currentTime = Date.now();
    
    if (expiresAt) {
      const expiresAtTime = +expiresAt;
      console.log('🔍 StorageService.getToken() - Token expires at:', new Date(expiresAtTime).toISOString());
      console.log('🔍 StorageService.getToken() - Current time:', new Date(currentTime).toISOString());
      
      if (currentTime > expiresAtTime) {
        console.log('❌ StorageService.getToken() - Token has expired, clearing storage');
        this.clear();
        return null;
      }
    }
    
    const token = localStorage.getItem(this.TOKEN_KEY);
    console.log('🔍 StorageService.getToken() - Retrieved token:', token ? token.substring(0, 20) + '...' : 'null');
    return token;
  }

  getTokenExpiration(): number | null {
    const expiresAt = localStorage.getItem(this.TOKEN_EXP_KEY);
    return expiresAt ? +expiresAt : null;
  }

  clear(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.ADMIN_KEY);
    localStorage.removeItem(this.TOKEN_EXP_KEY);
  localStorage.removeItem(this.ROLES_KEY);
  }

  setAdminStatus(isAdmin: boolean): void {
    localStorage.setItem(this.ADMIN_KEY, JSON.stringify(isAdmin));
  }

  isAdmin(): boolean {
    const isAdmin = localStorage.getItem(this.ADMIN_KEY);
    return isAdmin ? JSON.parse(isAdmin) : false;
  }

  // Roles helpers (Admin | Operador | Lectura)
  setRoles(roles: string[]): void {
    localStorage.setItem(this.ROLES_KEY, JSON.stringify(roles || []));
    // Back-compat for existing checks
    this.setAdminStatus(roles?.includes('Admin'));
  }

  getRoles(): string[] {
    const raw = localStorage.getItem(this.ROLES_KEY);
    try {
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  hasAnyRole(roles: string[]): boolean {
    const current = this.getRoles();
    return roles.some(r => current.includes(r));
  }
}