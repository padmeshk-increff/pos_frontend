import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * This is the new, modern functional interceptor.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>, 
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {

  const authService = inject(AuthService); // We inject the service using the inject() function
  const token = authService.getToken();

  if (token) {
    // If a token exists, clone the request to add the new header.
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // If the API returns a 401 Unauthorized, automatically log the user out.
      if (error.status === 401) {
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};

