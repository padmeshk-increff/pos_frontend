import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, catchError } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

export const authGuard: CanActivateFn = (route, state): Observable<boolean> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Always call checkAuthStatus - it handles sessionStorage check internally
  // and will use cached value if available (< 5 mins old)
  return authService.checkAuthStatus().pipe(
    map(user => {
      if (user) {
        return true; // User is authenticated
      }

      // User is not authenticated, redirect
      router.navigate(['/login'], { replaceUrl: true });
      return false;
    }),
    catchError((error) => {
      // Handle network errors gracefully - don't redirect if it's a network issue
      // Only redirect if we're sure the user is not authenticated
      // If there's a user in sessionStorage, give them the benefit of the doubt
      // (they might just have a network issue)
      const hasUserInStorage = sessionStorage.getItem('currentUser');
      
      if (hasUserInStorage) {
        // User exists in storage but API call failed - could be network issue
        // Try to load from storage (this will update the BehaviorSubject)
        try {
          authService.loadUserFromStorage();
          // If we have a user after loading from storage, allow access
          if (authService.currentUserValue) {
            return of(true); // Allow access with cached user
          }
        } catch {
          // If loading fails, user is not authenticated
        }
      }
      
      // No user in storage and API failed - definitely not authenticated
      router.navigate(['/login'], { replaceUrl: true });
      return of(false);
    })
  );
};