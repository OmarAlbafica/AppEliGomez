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
export class DashboardService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storage: StorageService) {}

  private getHeaders(): HttpHeaders | undefined {
    const token = this.storage.getToken();
    if (!token) return undefined;
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  getResumen(): Observable<ApiResponse> {
    const headers = this.getHeaders();
    if (!headers) {
      return of({ Status: false, Message: 'Token de autenticación requerido' });
    }
    return this.http.get<ApiResponse>(`${this.apiUrl}Interface/Dashboard/GetResumen`, { headers });
  }
}
