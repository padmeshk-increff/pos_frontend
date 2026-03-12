// src/app/services/auth.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'; // Import HttpHeaders
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { AuthUser } from '../models/auth-user.model';
import { LoginForm, UserForm } from '../models/user.model';
import { Role } from '../models/role.enum';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8080/pos'; // Your base API URL

  private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  private http = inject(HttpClient);
  private router = inject(Router);

  constructor() {
    this.loadUserFromStorage();
    // We check auth status. The interceptor will add withCredentials.
    this.checkAuthStatus().subscribe();
  }

  public loadUserFromStorage(): void {
    const userJson = sessionStorage.getItem('currentUser');
    if (userJson) {
      try {
        this.currentUserSubject.next(JSON.parse(userJson));
      } catch (error) {
        // If parsing fails, clear the invalid data
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('lastCheckedTime');
      }
    }
  }

  public get currentUserValue(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * This is the new "isLoggedIn".
   * It checks if a user is logged in, and if it's time to re-verify.
   * This implements your 5-minute cache requirement.
   */
  public checkAuthStatus(): Observable<AuthUser | null> {
    // First, ensure we've loaded from sessionStorage (in case constructor hasn't run yet)
    if (!this.currentUserValue) {
      this.loadUserFromStorage();
    }

    const lastCheckedStr = sessionStorage.getItem('lastCheckedTime');
    const now = new Date().getTime();

    // 1. If we have a user and it was checked < 5 mins ago, trust it.
    if (this.currentUserValue && lastCheckedStr) {
      const lastChecked = parseInt(lastCheckedStr, 10);
      const fiveMinutes = 5 * 60 * 1000;
      if ((now - lastChecked) < fiveMinutes) {
        return of(this.currentUserValue);
      }
    }

    // 2. Otherwise (no user or cache expired), call the backend "who am i" endpoint
    // The authInterceptor will add withCredentials: true
    return this.http.get<AuthUser>(`${this.apiUrl}/session/self`).pipe(
      tap(user => {
        // Successful check: store user and update timestamp
        this.storeUser(user);
      }),
      catchError((error) => {
        // API call failed - could be network error or no session
        // Only clear user if we're sure it's an auth error (401/403)
        // For other errors, keep the cached user (network might be down)
        if (error.status === 401 || error.status === 403) {
          // Definitely not authenticated - clear user
          this.logoutInternal();
          return of(null);
        }
        
        // Network error or other issue - keep cached user if available
        // This prevents users from being logged out due to temporary network issues
        if (this.currentUserValue) {
          // Keep the cached user but don't update timestamp (so it will retry next time)
          return of(this.currentUserValue);
        }
        
        // No cached user and API failed - definitely not authenticated
        this.logoutInternal();
        return of(null);
      })
    );
  }

  public hasRole(Role: Role): boolean {
    // Note: Changed parameter to 'Role' to avoid conflict with 'role' property
    return this.currentUserValue?.role === Role;
  }

  signup(form: UserForm): Observable<any> {
    // The authInterceptor will add withCredentials: true
    return this.http.post(`${this.apiUrl}/users/signup`, form);
  }

  /**
   * Login now hits the /session/login endpoint.
   * It expects the AuthUser object back from the server.
   *
   * --- THIS METHOD IS NOW FIXED ---
   * It sends form data, not JSON, to match your Spring formLogin().
   * The authInterceptor handles withCredentials for us.
   */
  login(form: LoginForm): Observable<AuthUser> {
    // Spring's formLogin() expects 'application/x-www-form-urlencoded'
    const body = new URLSearchParams();
    body.set('username', form.email); // Make sure LoginForm has 'username'
    body.set('password', form.password); // Make sure LoginForm has 'password'

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    // The authInterceptor is adding 'withCredentials: true' for us.
    return this.http
      .post<AuthUser>(`${this.apiUrl}/session/login`, body.toString(), { headers })
      .pipe(
        tap(user => {
          this.storeUser(user);
        })
      );
  }

  /**
   * Logout now hits the /session/logout endpoint.
   */
  logout(): void {
    // Clear user data immediately before navigation to prevent navbar flash
    this.logoutInternal();
    
    // Navigate immediately and forcefully - don't wait for API call
    this.router.navigate(['/login'], { replaceUrl: true }).then(success => {
      if (success) {
        // The authInterceptor will add withCredentials: true
        // Make logout API call in background (fire and forget)
        this.http.post(`${this.apiUrl}/session/logout`, {}).subscribe({
          next: () => {
            // Logout successful, but we've already navigated
          },
          error: () => {
            // Logout failed, but we've already navigated and cleared local state
          }
        });
      }
    });
  }

  /**
   * Helper to store user and timestamp
   */
  private storeUser(user: AuthUser): void {
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    sessionStorage.setItem('lastCheckedTime', new Date().getTime().toString());
    this.currentUserSubject.next(user);
  }

  /**
   * Helper to clear local state without redirecting
   * (to prevent guard loops)
   */
  public logoutInternal(): void {
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('lastCheckedTime');
    this.currentUserSubject.next(null);
  }
}