
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, of } from 'rxjs';
import { StorageService } from '../../../service/storage/storage.service';
import { tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storageService: StorageService) { }

  getResumen(): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const url = `${this.apiUrl}Interface/Dashboard/GetResumen`;
    return this.http.get<any>(url, { headers }).pipe(
      tap(response => console.log('📥 Respuesta recibida:', response)),
      catchError(error => {
        console.error('❌ Error en la petición de resumen:', error);
        return of(error);
      })
    );
  }
}
