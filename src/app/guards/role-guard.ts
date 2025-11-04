import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast';
import { Role } from '../models/role.enum';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastService = inject(ToastService);

  // 1. Get the required roles from the route's 'data' property
  const requiredRoles = route.data['roles'] as Role[];

  // If no roles are required for this route, allow access
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  // 2. Get the current user's role
  const currentUserRole = authService.currentUserValue?.role;

  // 3. Check if the user's role is in the required roles list
  if (currentUserRole && requiredRoles.includes(currentUserRole)) {
    return true; // User has the required role
  }

  // 4. If not, redirect and show an error
  toastService.showError('You do not have permission to access this page.');
  router.navigate(['/']); // Redirect to the dashboard
  return false;
};
