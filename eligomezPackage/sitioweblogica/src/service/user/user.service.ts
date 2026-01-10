import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StorageService } from '../storage/storage.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private storageService: StorageService) { }

  getUsers(search: string = ''): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      console.error('Token no encontrado');
      return new Observable(observer => {
        observer.error('Token no encontrado');
        observer.complete();
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = { search };

    return this.http.post<any>(`${this.apiUrl}/Users/GetUsers`, body, { headers });
  }

  deleteUser(Id: number): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      console.error('Token no encontrado');
      return new Observable(observer => {
        observer.error('Token no encontrado');
        observer.complete();
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = { Id };

    return this.http.post<any>(`${this.apiUrl}/Users/DeleteUser`, body, { headers });
}

createUser(user: any): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      console.error('Token no encontrado');
      return new Observable(observer => {
        observer.error('Token no encontrado');
        observer.complete();
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}/Users/CreateUser`, user, { headers });
  }

  updateUser(user: any): Observable<any> {
    const token = this.storageService.getToken();
    if (!token) {
      console.error('Token no encontrado');
      return new Observable(observer => {
        observer.error('Token no encontrado');
        observer.complete();
      });
    }

    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post<any>(`${this.apiUrl}/Users/UpdateUser`, user, { headers });
  }
}