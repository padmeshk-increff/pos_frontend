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
    const MAX_TOASTS = 3;
    
    // Add new toast to the beginning
    this.toasts = [newToast, ...this.toasts];
    
    // Limit to maximum 3 toasts - remove oldest ones (from the end of array)
    if (this.toasts.length > MAX_TOASTS) {
      // Get the toasts that exceed the limit (oldest ones at the end)
      const toastsToRemove = this.toasts.slice(MAX_TOASTS);
      
      // Start closing animation for old toasts and remove them
      toastsToRemove.forEach(oldToast => {
        if (!oldToast.closing) {
          oldToast.closing = true;
          // Remove after animation completes (600ms exit animation)
          setTimeout(() => {
            this.toasts = this.toasts.filter(t => t.id !== oldToast.id);
            this.toastSubject.next([...this.toasts]);
          }, 600);
        }
      });
      
      // Keep only the first MAX_TOASTS for immediate display
      this.toasts = this.toasts.slice(0, MAX_TOASTS);
    }
    
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

      // 2. Wait for the animation (600ms) to finish, then remove it from the array
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
        this.toastSubject.next([...this.toasts]);
      }, 600); 
    }
  }
}

