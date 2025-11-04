import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast';
import { LoginForm } from '../../models/user.model';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.css'] // Using a shared CSS file
})
export class LoginPageComponent {
  
  public form: LoginForm = { email: '', password: '' };
  public isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  public login(): void {
    if (!this.form.email || !this.form.password) {
      this.toastService.showError('Email and password are required.');
      return;
    }
    this.isLoading = true;
    
    this.authService.login(this.form)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => {
          this.toastService.showSuccess('Login successful!');
          this.router.navigate(['/']); // Navigate to the dashboard on success
        },
        error: (err) => {
          this.toastService.showError(err.error?.message || 'Login failed. Please check your credentials.');
        }
      });
  }
}
