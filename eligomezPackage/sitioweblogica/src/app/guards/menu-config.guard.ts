import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class MenuConfigGuard implements CanActivate {
  constructor(private http: HttpClient, private router: Router) {}

  canActivate(route: any): Observable<boolean> {
    return this.http.get<any>('/assets/menu-config.json').pipe(
      map(config => {
        // Detectar la ruta y validar la opción correspondiente
        // NOTE: banco feature removed; only validate central-config here
        if (route.routeConfig.path === 'main/central-config' && !config.showCentralConfig) {
          this.router.navigate(['/not-available']);
          return false;
        }
        return true;
      }),
      catchError(() => {
        this.router.navigate(['/not-available']);
        return of(false);
      })
    );
  }
}
