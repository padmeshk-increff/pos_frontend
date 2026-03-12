import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../services/toast';

/**
 * Utility function to extract user-friendly error messages from HTTP errors
 * Handles server down scenarios, HTML error responses, and various error formats
 */
export function handleHttpError(err: any, toastService: ToastService, defaultMessage: string = 'Unable to complete the request. Please try again.'): void {
  // Check if it's an HttpErrorResponse
  if (err instanceof HttpErrorResponse) {
    // Server down or connection errors (status 0 typically means network error)
    if (err.status === 0 || err.status === 500 || err.status === 502 || err.status === 503 || err.status === 504) {
      toastService.showError('Server is currently unavailable. Please try again later.');
      return;
    }

    // Check if error is HTML (server error pages)
    if (err.error && typeof err.error === 'string' && (err.error.trim().startsWith('<!DOCTYPE') || err.error.trim().startsWith('<html'))) {
      toastService.showError('Server is currently unavailable. Please try again later.');
      return;
    }

    // Check if error is a Blob that might be HTML
    if (err.error instanceof Blob) {
      // If it's a blob, we can't easily check if it's HTML without reading it
      // For now, show a generic server error
      toastService.showError('Server is currently unavailable. Please try again later.');
      return;
    }

    // Try to extract error message from JSON response
    if (err.error) {
      // If error.error is a string (might be HTML or plain text error)
      if (typeof err.error === 'string') {
        // Check if it looks like HTML
        if (err.error.trim().startsWith('<!DOCTYPE') || err.error.trim().startsWith('<html')) {
          toastService.showError('Server is currently unavailable. Please try again later.');
          return;
        }
        // Otherwise, it might be a plain text error message
        toastService.showError(err.error);
        return;
      }

      // If error.error is an object, try to extract message
      if (typeof err.error === 'object' && err.error !== null) {
        // Check for common error message fields
        if (err.error.message && typeof err.error.message === 'string') {
          toastService.showError(err.error.message);
          return;
        }

        // Check for error field
        if (err.error.error && typeof err.error.error === 'string') {
          toastService.showError(err.error.error);
          return;
        }

        // Check for array of error messages
        if (Array.isArray(err.error.errors)) {
          err.error.errors.forEach((msg: any) => {
            if (typeof msg === 'string') {
              toastService.showError(msg);
            }
          });
          return;
        }

        // Try to extract any string values from the error object
        const errorMessages: string[] = [];
        Object.values(err.error).forEach((value: any) => {
          if (typeof value === 'string' && value.trim() && !value.trim().startsWith('<!DOCTYPE') && !value.trim().startsWith('<html')) {
            errorMessages.push(value);
          } else if (Array.isArray(value)) {
            value.forEach((item: any) => {
              if (typeof item === 'string' && item.trim()) {
                errorMessages.push(item);
              }
            });
          }
        });

        if (errorMessages.length > 0) {
          errorMessages.forEach(msg => toastService.showError(msg));
          return;
        }
      }
    }

    // If we have a status but no parseable error, show status-based message
    if (err.status >= 400 && err.status < 500) {
      toastService.showError('Invalid request. Please check your input and try again.');
      return;
    }

    if (err.status >= 500) {
      toastService.showError('Server error occurred. Please try again later.');
      return;
    }
  }

  // Handle non-HTTP errors
  if (err && typeof err === 'object') {
    if (err.message && typeof err.message === 'string') {
      // Check if message is HTML
      if (err.message.trim().startsWith('<!DOCTYPE') || err.message.trim().startsWith('<html')) {
        toastService.showError('Server is currently unavailable. Please try again later.');
        return;
      }
      toastService.showError(err.message);
      return;
    }
  }

  // Fallback to default message
  toastService.showError(defaultMessage);
}

