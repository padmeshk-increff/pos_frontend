import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// A type definition for our toast messages
export interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

// An internal interface that includes a unique ID and animation state
export interface ToastWithId extends ToastMessage {
  id: number;
  closing?: boolean; // Used to trigger the exit animation
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastSubject = new BehaviorSubject<ToastWithId[]>([]);
  private toasts: ToastWithId[] = [];
  private nextId = 0;

  public toasts$: Observable<ToastWithId[]> = this.toastSubject.asObservable();

  showSuccess(message: string, duration: number = 3600) {
    this.addToast({ message, type: 'success' }, duration);
  }

  showError(message: string, duration: number = 3600) {
    this.addToast({ message, type: 'error' }, duration);
  }

  private addToast(toast: ToastMessage, duration: number) {
    const newToast: ToastWithId = { ...toast, id: this.nextId++, closing: false };
    
    this.toasts = [newToast, ...this.toasts];
    this.toastSubject.next([...this.toasts]);

    // Set a timer to automatically start the removal process
    setTimeout(() => {
      this.removeToast(newToast.id);
    }, duration);
  }

  /**
   * Begins the removal process for a toast, allowing its animation to play.
   */
  removeToast(id: number) {
    const toast = this.toasts.find(t => t.id === id);
    if (toast && !toast.closing) {
      // 1. Mark the toast as 'closing' to trigger the CSS animation
      toast.closing = true;
      this.toastSubject.next([...this.toasts]);

      // 2. Wait for the animation (400ms) to finish, then remove it from the array
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.toastSubject.next([...this.toasts]);
      }, 400); 
    }
  }
}

