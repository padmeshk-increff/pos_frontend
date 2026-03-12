import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,

} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service'; // Ensure this path is correct

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {

  const authService = inject(AuthService);
  const router = inject(Router);
  // const tokenExtractor = inject(HttpXsrfTokenExtractor); // 2. REMOVED: No longer needed

  // 3. This is perfect! This adds withCredentials to EVERY request.
  // This is better than adding it in each service.
  req = req.clone({
    withCredentials: true
  });
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // This 401 logout logic is still correct
      if (error.status === 401 && !req.url.includes('/session/login')) {
        // You might need a way to log the user out without
        // causing a circular dependency if AuthService uses HttpClient
        // But if authService.logoutInternal() just clears local state, this is fine.
        authService.logoutInternal(); // Assuming this clears local user info
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};