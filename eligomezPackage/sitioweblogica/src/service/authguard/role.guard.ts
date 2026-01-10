import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { StorageService } from '../storage/storage.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private storage: StorageService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const expectedRoles: string[] = route.data?.['roles'] || [];
    if (!expectedRoles.length) return true; // No roles required

    if (this.storage.hasAnyRole(expectedRoles)) {
      return true;
    }

    this.router.navigate(['/not-available']);
    return false;
  }
}
