import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from '../../../service/storage/storage.service';

export interface ProductoRegla {
  Id: number;
  ReglaId: number;
  ItemSid: string;
  Sku: string;
  SbsNo?: number;
  SbsName?: string;
  Description1?: string;
  Description2?: string;
  Description3?: string;
  Upc?: string;
  Activo: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface GetProductosReglaRequest {
  ReglaId?: number;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductosReglaService {
  buscarProductosPrismRegla(filtros: any): Observable<any> {
    const params = [];
    if (filtros.sbsNo !== undefined && filtros.sbsNo !== null) params.push(`sbsNo=${encodeURIComponent(filtros.sbsNo)}`);
    if (filtros.busqueda) params.push(`buscar=${encodeURIComponent(filtros.busqueda)}`);
    if (filtros.soloDisponibles !== undefined) params.push(`soloDisponibles=${filtros.soloDisponibles}`);
    if (filtros.limite !== undefined) params.push(`limite=${filtros.limite}`);
    if (filtros.reglaId !== undefined && filtros.reglaId !== null) params.push(`reglaId=${encodeURIComponent(filtros.reglaId)}`);
    const query = params.length ? `?${params.join('&')}` : '';
    const url = `${this.apiUrl}Interface/ProductoRegla/BuscarProductosPrismRegla${query}`;
    return this.http.get(url, this.getHeaders());
  }
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storageService: StorageService) {}

  private getHeaders(): any {
    const token = this.storageService.getToken();
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }

  getProductosRegla(request: GetProductosReglaRequest): Observable<any> {
    const url = `${this.apiUrl}Interface/ReglaProducto/BuscarProductosRegla`;
    return this.http.post(url, request, this.getHeaders());
  }

  createProductoRegla(producto: ProductoRegla): Observable<any> {
    const url = `${this.apiUrl}Interface/ReglaProducto/CreateProductoRegla`;
    return this.http.post(url, producto, this.getHeaders());
  }

  updateProductoRegla(producto: ProductoRegla): Observable<any> {
    const url = `${this.apiUrl}Interface/ReglaProducto/UpdateProductoRegla`;
    return this.http.post(url, producto, this.getHeaders());
  }

  deleteProductoRegla(id: number): Observable<any> {
    const url = `${this.apiUrl}Interface/ReglaProducto/DeleteProductoRegla`;
    return this.http.post(url, { id }, this.getHeaders());
  }
}
