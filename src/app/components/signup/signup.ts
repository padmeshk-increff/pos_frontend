import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast';
import { UserForm } from '../../models/user.model';

@Component({
  selector: 'app-signup-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrls: ['./signup.css'] // Using a shared CSS file
})
export class SignupPageComponent {

  public form: UserForm = { email: '', password: '' };
  public confirmPassword = '';
  public isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService
  ) {}

  public signup(): void {
    if (!this.form.email || !this.form.password || !this.confirmPassword) {
      this.toastService.showError('All fields are required.');
      return;
    }
    if (this.form.password !== this.confirmPassword) {
      this.toastService.showError('Passwords do not match.');
      return;
    }
    // You can add your password regex validation here
    
    this.isLoading = true;
    
    this.authService.signup(this.form)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          this.toastService.showSuccess(response.message);
          this.router.navigate(['/login']); // Redirect to login after successful signup
        },
        error: (err) => {
          this.toastService.showError(err.error?.message || 'Signup failed. Please try again.');
        }
      });
  }
}
