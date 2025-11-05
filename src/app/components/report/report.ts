import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

import { ReportService } from '../../services/report'; // Assuming you create this service
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report.html',
  styleUrl: './report.css'
})
export class ReportPageComponent {
  // State for Sales Report
  public startDate: string | null = null; // Bound to date input (YYYY-MM-DD)
  public endDate: string | null = null;   // Bound to date input (YYYY-MM-DD)
  public isDownloadingSales = false;

  // State for Inventory Report
  public isDownloadingInventory = false;

  constructor(
    private reportService: ReportService,
    private toastService: ToastService
  ) { }

  downloadSalesReport(): void {
    if (!this.startDate || !this.endDate) {
      this.toastService.showError('Please select both a start and end date.');
      return;
    }

    // Basic date validation
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    if (start > end) {
      this.toastService.showError('Start date cannot be after end date.');
      return;
    }

    // Convert dates to ZonedDateTime ISO strings (start of day / end of day UTC)
    // Adjust timezone handling if your backend expects local time
    const startIso = new Date(this.startDate + 'T00:00:00Z').toISOString();
    const endIso = new Date(this.endDate + 'T23:59:59Z').toISOString();


    this.isDownloadingSales = true;
    this.reportService.downloadSalesReport(startIso, endIso)
      .pipe(finalize(() => this.isDownloadingSales = false))
      .subscribe({
        next: (blob) => {
          this.triggerTsvDownload(blob, `sales-report-${this.startDate}-to-${this.endDate}.tsv`);
          this.toastService.showSuccess('Sales report download started.');
        },
        error: (err) => this.handleBlobError(err, 'sales')
      });
  }

  downloadInventoryReport(): void {
    this.isDownloadingInventory = true;
    this.reportService.downloadInventoryReport()
      .pipe(finalize(() => this.isDownloadingInventory = false))
      .subscribe({
        next: (blob) => {
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          this.triggerTsvDownload(blob, `inventory-report-${today}.tsv`);
          this.toastService.showSuccess('Inventory report download started.');
        },
        error: (err) => this.handleBlobError(err, 'inventory')
      });
  }

  // --- Helper for TSV Download ---
  private triggerTsvDownload(blob: Blob, filename: string): void {
    if (blob.size === 0) {
      this.toastService.showError('Report file not found or is empty.');
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Cleanup
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  // --- Error Handling ---
  /** Handles errors where the response might be a Blob */
  private handleBlobError(err: HttpErrorResponse, reportType: 'sales' | 'inventory'): void {
    if (err.error instanceof Blob && err.error.type === "application/json") {
      // If the server sent a JSON error inside the blob
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const errorJson = JSON.parse(e.target.result);
          this.handleApiError({ error: errorJson }, reportType); // Pass the parsed JSON
        } catch (parseError) {
          this.toastService.showError(`Failed to download ${reportType} report and could not parse error details.`);
        }
      };
      reader.onerror = () => {
        this.toastService.showError(`Failed to read error response from ${reportType} report download.`);
      };
      reader.readAsText(err.error);
    } else {
      // Handle non-blob errors or blobs that aren't JSON
      this.handleApiError(err, reportType);
    }
  }

  /** Centralized handler for standard API errors */
  private handleApiError(err: any, reportType: 'sales' | 'inventory'): void {
    let action = `downloading ${reportType} report`;
    if (err.error?.message && typeof err.error.message === 'string') {
      this.toastService.showError(err.error.message);
    } else {
      this.toastService.showError(`Error ${action}. Please try again.`);
      console.error(`Error ${action}:`, err);
    }
  }
}
