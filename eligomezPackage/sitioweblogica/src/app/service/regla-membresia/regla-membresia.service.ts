import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from '../../../service/storage/storage.service';

export interface ApiResponse {
  Status: boolean;
  Message: string;
  Result?: any;
  Data?: any;
  CorrelationId?: string;
}

@Injectable({ providedIn: 'root' })
export class ReglaMembresiaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storage: StorageService) {}

  private getHeaders(): HttpHeaders | undefined {
    const token = this.storage.getToken();
    if (!token) return undefined;
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  listByMembresia(ltyLevelId: string): Observable<ApiResponse> {
    const headers = this.getHeaders();
    if (!headers) {
      return of({ Status: false, Message: 'Token de autenticación requerido' });
    }
    return this.http.get<ApiResponse>(`${this.apiUrl}Interface/ReglaMembresia/ListByMembresia/${ltyLevelId}`, { headers });
  }

  create(payload: any): Observable<ApiResponse> {
    const headers = this.getHeaders();
    if (!headers) {
      return of({ Status: false, Message: 'Token de autenticación requerido' });
    }
    return this.http.post<ApiResponse>(`${this.apiUrl}Interface/ReglaMembresia/CreateReglaMembresia`, payload, { headers });
  }

  update(id: number | string, payload: any): Observable<ApiResponse> {
    const headers = this.getHeaders();
    if (!headers) {
      return of({ Status: false, Message: 'Token de autenticación requerido' });
    }
    return this.http.post<ApiResponse>(`${this.apiUrl}Interface/ReglaMembresia/UpdateReglaMembresia/${id}`, payload, { headers });
  }
}
