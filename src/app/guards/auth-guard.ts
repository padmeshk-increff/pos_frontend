import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true; // If the user is logged in, allow access to the route.
  }

  // If the user is not logged in, redirect them to the login page and block access.
  router.navigate(['/login']);
  return false;
};

