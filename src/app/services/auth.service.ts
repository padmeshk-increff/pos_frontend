import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { UserForm, LoginForm, LoginResponse } from '../models/user.model';
import { Role } from '../models/role.enum';

// A clean interface for the user object we'll store
export interface AuthUser {
    email: string;
    role: Role;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = 'http://localhost:8080/pos';

    private currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient, private router: Router) {
        this.loadUserFromStorage();
    }

    private loadUserFromStorage(): void {
        const userJson = sessionStorage.getItem('currentUser');
        if (userJson) {
            this.currentUserSubject.next(JSON.parse(userJson));
        }
    }

    public get currentUserValue(): AuthUser | null {
        return this.currentUserSubject.value;
    }

    public isLoggedIn(): boolean {
        return !!sessionStorage.getItem('authToken');
    }

    public hasRole(role: Role): boolean {
        return this.currentUserValue?.role === role;
    }

    public getToken(): string | null {
        return sessionStorage.getItem('authToken');
    }

    signup(form: UserForm): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.apiUrl}/users/signup`, form);
    }

    login(form: LoginForm): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.apiUrl}/session/login`, form).pipe(
            tap(response => {
                // On successful login, store the token and user info
                sessionStorage.setItem('authToken', response.token);
                const user: AuthUser = { email: response.email, role: response.role as Role };
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                this.currentUserSubject.next(user);
            })
        );
    }

    logout(): void {
        // Clear all session data, notify subscribers, and redirect to login
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
    }
}

