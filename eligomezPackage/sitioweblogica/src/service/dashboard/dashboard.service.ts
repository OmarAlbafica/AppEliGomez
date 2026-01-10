import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import { tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storageService: StorageService) { }

  getResumen(): Observable<any> {
    console.log('🔐 Verificando token de autenticación...');
    const token = this.storageService.getToken();
    if (!token) {
      console.log('❌ No hay token de autenticación');
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    console.log('✅ Token encontrado:', token ? 'Presente' : 'Ausente');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const url = `${this.apiUrl}Interface/Dashboard/GetResumen`;
    const body = {};

    console.log('🌐 Realizando petición a:', url);
    console.log('📋 Headers:', headers.get('Authorization') ? 'Authorization header presente' : 'Sin Authorization header');

    return this.http.post<any>(url, body, { headers }).pipe(
      tap(response => console.log('📥 Respuesta recibida:', response)),
      catchError(error => {
        console.error('❌ Error en la petición de resumen:', error);
        return of(error);
      })
    );
  }
}
