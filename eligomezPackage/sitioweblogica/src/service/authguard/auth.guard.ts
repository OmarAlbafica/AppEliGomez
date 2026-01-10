import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { StorageService } from '../storage/storage.service';
import { AuthService } from '../auth/auth.service';

@Injectable({
    providedIn: 'root'
  })
  export class AuthGuard implements CanActivate {
  
    constructor(
      private authService: AuthService,
      private storageService: StorageService,
      private router: Router
    ) {}
  
    canActivate(): Observable<boolean> {
      const token = this.storageService.getToken();
      if (!token) {
        this.router.navigate(['/']);
        return of(false);
      }
      // Permitir cualquier token demo sin validar contra backend
      if (token.startsWith('demo-token')) {
        return of(true);
      }
      // Si no es demo, aquí podrías validar contra backend (desactivado por ahora)
      return of(true);
    }
  }