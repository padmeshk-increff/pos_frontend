// src/app/guards/role.guard.ts

import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast'; // Assuming you have this
import { Role } from '../models/role.enum';
import { map } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot): Observable<boolean> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  const requiredRoles = route.data['roles'] as Role[];

  if (!requiredRoles || requiredRoles.length === 0) {
    return of(true); // No roles required
  }

  // Also call the async auth check to get the latest user
  return authService.checkAuthStatus().pipe(
    map(user => {
      const currentUserRole = user?.role;

      if (currentUserRole && requiredRoles.includes(currentUserRole)) {
        return true; // User has the required role
      }

      // If not, redirect and show an error
      toastService.showError('You do not have permission to access this page.');
      router.navigate(['/']); // Redirect to dashboard
      return false;
    })
  );
};