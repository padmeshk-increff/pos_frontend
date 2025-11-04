import { Component } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { ToastService, ToastWithId } from '../../services/toast';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './toast.html',
  styleUrls: ['./toast.css']
})
export class ToastComponent {
  // The component now holds an Observable list of toasts
  toasts$: Observable<ToastWithId[]>;

  constructor(private toastService: ToastService) {
    this.toasts$ = this.toastService.toasts$;
  }

  // This method is called from the template to remove a toast
  closeToast(id: number) {
    this.toastService.removeToast(id);
  }
}
