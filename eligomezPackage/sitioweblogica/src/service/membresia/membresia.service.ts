import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, of } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import { 
  Subsidiaria, 
  MembresiaSubsidiaria, 
  CreateMembresiaWithSubsidiariasRequest,
  UpdateMembresiaWithSubsidiariasRequest,
  MembresiaWithSubsidiarias
} from '../../app/interfaces/membresia-subsidiarias.interface';
import { tap, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MembresiaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storageService: StorageService) { }

  getMembresias(search: string = ''): Observable<any> {
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
    const body = { search };
    const url = `${this.apiUrl}Interface/Membresia/GetMembresias`;
    
    console.log('🌐 Realizando petición a:', url);
    console.log('📤 Cuerpo de la petición:', body);
    console.log('📋 Headers:', headers.get('Authorization') ? 'Authorization header presente' : 'Sin Authorization header');

    return this.http.post<any>(url, body, { headers }).pipe(
      tap(response => console.log('📥 Respuesta recibida:', response)),
      catchError(error => {
        console.error('❌ Error en la petición:', error);
        return of(error);
      })
    );
  }

  createMembresia(membresia: any): Observable<any> {
    console.log('🔧 Creando membresía con datos:', membresia);
    const token = this.storageService.getToken();
    if (!token) {
      console.log('❌ No hay token de autenticación');
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/CreateMembresia`, membresia, { headers }).pipe(
      tap(response => console.log('📥 Respuesta recibida:', response)),
      catchError(error => {
        console.error('❌ Error en la creación de membresía:', error);
        return of(error);
      })
    );
  }

  updateMembresia(membresia: any): Observable<any> {
    console.log('🔄 Actualizando membresía con datos:', membresia);
    const token = this.storageService.getToken();
    if (!token) {
      console.log('❌ No hay token de autenticación');
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/UpdateMembresia`, membresia, { headers }).pipe(
      tap(response => console.log('📥 Respuesta recibida:', response)),
      catchError(error => {
        console.error('❌ Error en la actualización de membresía:', error);
        return of(error);
      })
    );
  }

  deleteMembresia(id: string): Observable<any> {
    console.log('🗑️ Eliminando membresía con ID:', id);
    const token = this.storageService.getToken();
    if (!token) {
      console.log('❌ No hay token de autenticación');
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = { Id: id };
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/DeleteMembresia`, body, { headers }).pipe(
      tap(response => console.log('📥 Respuesta recibida:', response)),
      catchError(error => {
        console.error('❌ Error en la eliminación de membresía:', error);
        return of(error);
      })
    );
  }

  getMembresiaById(id: string): Observable<any> {
    console.log('🔍 Obteniendo membresía con ID:', id);
    const token = this.storageService.getToken();
    if (!token) {
      console.log('❌ No hay token de autenticación');
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = { Id: id };
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/GetMembresiaById`, body, { headers }).pipe(
      tap(response => console.log('📥 Respuesta recibida:', response)),
      catchError(error => {
        console.error('❌ Error al obtener membresía:', error);
        return of(error);
      })
    );
  }

  getMembresiasPorNivel(): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/GetMembresiasPorNivel`, {}, { headers });
  }

  // =====================================================
  // FUNCIONES PARA GESTIÓN DE SUBSIDIARIAS
  // =====================================================

  getSubsidiariasDisponibles(): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/GetSubsidiariasDisponibles`, {}, { headers });
  }

  getSubsidiariasByMembresia(membresiaId: string): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = { MembresiaId: membresiaId };
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/GetSubsidiariasByMembresia`, body, { headers });
  }

  createMembresiaWithSubsidiarias(membresia: CreateMembresiaWithSubsidiariasRequest): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/CreateMembresiaWithSubsidiarias`, membresia, { headers });
  }

  updateMembresiaWithSubsidiarias(membresia: UpdateMembresiaWithSubsidiariasRequest): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/UpdateMembresiaWithSubsidiarias`, membresia, { headers });
  }

  asignarSubsidiariasMembresia(membresiaId: string, subsidiariasIds: number[]): Observable<any>;
  asignarSubsidiariasMembresia(asignacionData: any): Observable<any>;
  asignarSubsidiariasMembresia(membresiaIdOrData: string | any, subsidiariasIds?: number[]): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    
    // Si es un string, usar el formato anterior
    let body;
    if (typeof membresiaIdOrData === 'string') {
      body = { 
        MembresiaId: membresiaIdOrData, 
        SubsidiariasIds: subsidiariasIds || []
      };
    } else {
      // Si es un objeto, usarlo directamente
      body = membresiaIdOrData;
    }
    
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/AsignarSubsidiariasMembresia`, body, { headers });
  }

  getMembresiaConSubsidiarias(): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}Interface/Membresia/GetMembresiaConSubsidiarias`, {}, { headers });
  }

  // Obtener rangos de precios de una membresía
  getRangosPrecios(membresiaSubsidiariaId: number): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = { membresiaSubsidiariaId };
    const url = `${this.apiUrl}Interface/Membresia/GetRangosPrecios`;

    return this.http.post<any>(url, body, { headers }).pipe(
      tap(response => console.log('📥 Rangos obtenidos:', response)),
      catchError(error => {
        console.error('❌ Error al obtener rangos:', error);
        return of(error);
      })
    );
  }

  // Guardar rangos de precios
  guardarRangosPrecios(membresiaSubsidiariaId: number, rangos: any[]): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      return of({
        Status: false,
        Message: 'Token de autenticación requerido'
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = { 
      membresiaSubsidiariaId,
      rangos 
    };
    const url = `${this.apiUrl}Interface/Membresia/GuardarRangosPrecios`;

    return this.http.post<any>(url, body, { headers }).pipe(
      tap(response => console.log('📥 Rangos guardados:', response)),
      catchError(error => {
        console.error('❌ Error al guardar rangos:', error);
        return of(error);
      })
    );
  }
}