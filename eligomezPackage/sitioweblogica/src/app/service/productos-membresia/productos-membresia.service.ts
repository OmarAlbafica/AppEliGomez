import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from '../../../service/storage/storage.service';

export interface ProductoMembresia {
  Id: string;
  MembresiaId: string;
  ItemSid: string;
  Sku: string;
  SbsNo?: number;
  SbsName?: string;
  Description1?: string;
  Description2?: string;
  Description3?: string;
  Upc?: string;
  Activo: boolean;
  FechaCreacion: string;
  FechaActualizacion: string;
  Type?: string;
}

export interface GetProductosMembresiaRequest {
  MembresiaId?: string;
  ItemSid?: string;
  SbsNo?: number;
  Activo?: boolean;
}

export interface CreateProductoMembresiaRequest {
  MembresiaId: string;
  ItemSid: string;
  Upc?: string;
  Description1?: string;
  Description2?: string;
  Description3?: string;
  SbsNo: number;
  Activo: boolean;
  TYPE: string; // 'RENOVACION' o 'COMPRA'
}

export interface UpdateProductoMembresiaRequest {
  Id: string;
  MembresiaId: string;
  ItemSid: string;
  Upc?: string;
  Description1?: string;
  Description2?: string;
  Description3?: string;
  SbsNo: number;
  Activo: boolean;
  TYPE?: string;
}

export interface ApiResponse {
  Status: boolean;
  Message: string;
  Result?: any;
  Data?: any;
  CorrelationId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductosMembresiaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storageService: StorageService) {}

  private getHeaders(): HttpHeaders {
    const token = this.storageService.getToken();
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  getProductosMembresia(request?: GetProductosMembresiaRequest): Observable<ApiResponse> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = this.getHeaders();
    const url = `${this.apiUrl}Interface/ProductosMembresia/GetProductosMembresia`;
    
    // Send request as POST with body as expected by backend
    return this.http.post<ApiResponse>(url, request || {}, { headers });
  }

  createProductoMembresia(request: CreateProductoMembresiaRequest): Observable<ApiResponse> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = this.getHeaders();
    return this.http.post<ApiResponse>(`${this.apiUrl}Interface/ProductosMembresia/CreateProductoMembresia`, request, { headers });
  }

  updateProductoMembresia(request: UpdateProductoMembresiaRequest): Observable<ApiResponse> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = this.getHeaders();
    return this.http.post<ApiResponse>(`${this.apiUrl}Interface/ProductosMembresia/UpdateProductoMembresia`, request, { headers });
  }

  deleteProductoMembresia(id: string): Observable<ApiResponse> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = this.getHeaders();
    return this.http.post<ApiResponse>(`${this.apiUrl}Interface/ProductosMembresia/DeleteProductoMembresia`, { id }, { headers });
  }

  getProductoMembresiaById(id: string): Observable<ApiResponse> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = this.getHeaders();
    return this.http.post<ApiResponse>(`${this.apiUrl}Interface/ProductosMembresia/GetProductoMembresiaById`, { id }, { headers });
  }
}