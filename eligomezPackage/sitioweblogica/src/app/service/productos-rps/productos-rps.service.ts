import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from '../../../service/storage/storage.service';

export interface SubsidiariaConfig {
  id: number;
  sbsNo: number;
  sbsName: string;
  sbsSid: number;
  activoLealtad: boolean;
  descripcion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductoRPS {
  itemSid: string; // El SID real como string
  sid: number; // El SID como número
  sku: string;
  upc?: string;
  description1?: string;
  description2?: string;
  description3?: string;
  sbsNo: number;
  sbsName: string;
  descripcionDisplay: string;
  usadoEnMembresia: boolean;
  usadoEnPromociones: boolean;
}

export interface ProductoMembresia {
  id: string;
  membresiaId: string;
  sku: string;
  nombreProducto?: string;
  precioProducto?: number;
  sidRps?: number;
  upc?: string;
  description1?: string;
  description2?: string;
  description3?: string;
  sbsNo: number;
  syncRps: boolean;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  membresia?: any;
}

export interface FiltrosProductosRPS {
  sbsNo?: number;
  busqueda?: string;
  soloDisponibles?: boolean;
  membresiaId?: string; // Para excluir productos ya asignados a esta miembresía
  limite?: number; // Límite de resultados (10, 100, 1000, 10000)
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  productos: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProductosRpsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storageService: StorageService) {}

  private getHeaders(): HttpHeaders {
    const token = this.storageService.getToken();
    console.log('🔐 Token desde StorageService:', token ? `${token.substring(0, 20)}...` : 'NULL');
    
    if (!token) {
      console.error('❌ No se encontró token en StorageService');
      throw new Error('Token de autenticación no encontrado');
    }
    
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    console.log('📋 Header Authorization configurado:', headers.get('Authorization') ? 'SÍ' : 'NO');
    return headers;
  }

  // ===== SUBSIDIARIAS =====
  getSubsidiarias(): Observable<ApiResponse<SubsidiariaConfig[]>> {
    return this.http.get<ApiResponse<SubsidiariaConfig[]>>(`${this.apiUrl}api/subsidiarias`);
  }

  createSubsidiaria(subsidiaria: Partial<SubsidiariaConfig>): Observable<ApiResponse<SubsidiariaConfig>> {
    return this.http.post<ApiResponse<SubsidiariaConfig>>(`${this.apiUrl}api/subsidiarias`, subsidiaria);
  }

  updateSubsidiaria(id: number, subsidiaria: Partial<SubsidiariaConfig>): Observable<ApiResponse<SubsidiariaConfig>> {
    return this.http.put<ApiResponse<SubsidiariaConfig>>(`${this.apiUrl}api/subsidiarias/${id}`, subsidiaria);
  }

  deleteSubsidiaria(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}api/subsidiarias/${id}`);
  }

  // ===== PRODUCTOS RPS =====
  buscarProductosRPS(filtros: FiltrosProductosRPS): Observable<ApiResponse<{productos: ProductoRPS[], totalMostrados: number, limite: number}>> {
    let params = new HttpParams();
    
    if (filtros.sbsNo) params = params.set('sbsNo', filtros.sbsNo.toString());
    if (filtros.busqueda) params = params.set('buscar', filtros.busqueda);
    if (filtros.soloDisponibles !== undefined) params = params.set('soloDisponibles', filtros.soloDisponibles.toString());
    if (filtros.membresiaId) params = params.set('membresiaId', filtros.membresiaId);
    if (filtros.limite) params = params.set('limite', filtros.limite.toString());

    const headers = this.getHeaders();
    return this.http.get<ApiResponse<{productos: ProductoRPS[], totalMostrados: number, limite: number}>>(`${this.apiUrl}Interface/ProductosMembresia/BuscarProductosPrism`, { params, headers });
  }

  getProductosRPSBySubsidiaria(sbsNo: number): Observable<ApiResponse<ProductoRPS[]>> {
    return this.http.get<ApiResponse<ProductoRPS[]>>(`${this.apiUrl}api/productos-rps/subsidiaria/${sbsNo}`);
  }

  sincronizarProductosRPS(): Observable<ApiResponse<{sincronizados: number}>> {
    return this.http.post<ApiResponse<{sincronizados: number}>>(`${this.apiUrl}api/productos-rps/sincronizar`, {});
  }

  // ===== PRODUCTOS MEMBRESÍA =====
  getProductosMembresia(): Observable<ApiResponse<ProductoMembresia[]>> {
    return this.http.get<ApiResponse<ProductoMembresia[]>>(`${this.apiUrl}api/productos-membresia`);
  }

  agregarSkuAMembresia(data: {
    membresiaId: number;
    sku: string;
    sbsNo: number;
    precioProducto?: number;
    syncRps: boolean;
  }): Observable<ApiResponse<ProductoMembresia>> {
    return this.http.post<ApiResponse<ProductoMembresia>>(`${this.apiUrl}api/productos-membresia/agregar-sku`, data);
  }

  agregarSkusMasivoAMembresia(data: {
    membresiaId: number;
    productos: Array<{
      sku: string;
      sbsNo: number;
      precioProducto?: number;
    }>;
    syncRps: boolean;
  }): Observable<ApiResponse<{agregados: number; errores: number; productos: ProductoMembresia[]}>> {
    return this.http.post<ApiResponse<{agregados: number; errores: number; productos: ProductoMembresia[]}>>(`${this.apiUrl}api/productos-membresia/agregar-masivo`, data);
  }

  updateProductoMembresia(id: string, data: Partial<ProductoMembresia>): Observable<ApiResponse<ProductoMembresia>> {
    return this.http.put<ApiResponse<ProductoMembresia>>(`${this.apiUrl}api/productos-membresia/${id}`, data);
  }

  deleteProductoMembresia(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}api/productos-membresia/${id}`);
  }

  // ===== PRODUCTOS PROMOCIÓN =====
  getProductosPromocion(promocionId: number): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}api/promociones/${promocionId}/productos`);
  }
  // ===== SUBSIDIARIAS DISPONIBLES PARA REGLA =====
  getSubsidiariasDisponibles(): Observable<any> {
    const headers = this.getHeaders();
    // POST vacío al endpoint correcto
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/GetSubsidiariasDisponibles`, {}, { headers });
  }
  agregarSkuAPromocion(promocionId: number, data: {
    sku: string;
    sbsNo: number;
    syncRps: boolean;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}api/promociones/${promocionId}/productos/agregar-sku`, data);
  }

  agregarSkusMasivoAPromocion(promocionId: number, data: {
    productos: Array<{
      sku: string;
      sbsNo: number;
    }>;
    syncRps: boolean;
  }): Observable<ApiResponse<{agregados: number; errores: number}>> {
    return this.http.post<ApiResponse<{agregados: number; errores: number}>>(`${this.apiUrl}api/promociones/${promocionId}/productos/agregar-masivo`, data);
  }

  deleteProductoPromocion(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}api/promociones/productos/${id}`);
  }
}