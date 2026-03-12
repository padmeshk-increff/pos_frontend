import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';

import { ReportService } from '../../services/report'; // Assuming you create this service
import { ToastService } from '../../services/toast';
import { handleHttpError } from '../../utils/error-handler';

@Component({
  selector: 'app-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './report.html',
  styleUrl: './report.css',
  animations: [
    trigger('shellFadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        // Fade in shell with no delay
        animate('0.5s ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ])
  ]
})
export class ReportPageComponent implements AfterViewInit {
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

  ngAfterViewInit(): void {
    // Set up border glow effect for reports card
    this.setupGlowEffect();
  }

  private setupGlowEffect(): void {
    const setupElements = () => {
      // Get the reports card
      const reportsCard = document.querySelector('.reports-card') as HTMLElement;

      if (!reportsCard) {
        setTimeout(setupElements, 100);
        return;
      }

      if ((reportsCard as any).__glowSetup) return;
      (reportsCard as any).__glowSetup = true;

      let lastMoveTime = 0;
      let fadeAnimationFrame: number | null = null;
      let positionAnimationFrame: number | null = null;
      let cachedRect: DOMRect | null = null;
      let rectCacheTime = 0;
      
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;
      
      let lastX = 0;
      let lastY = 0;
      let lastTime = 0;
      const velocityHistory: number[] = [];
      const MAX_VELOCITY_HISTORY = 5;
      let currentVelocity = 0;
      
      let targetSize = 200;
      let currentSize = 200;
      
      const fadeOutDelay = 200;
      const fadeOutDuration = 300;
      const RECT_CACHE_DURATION = 100;
      const SMOOTH_FOLLOW_SPEED = 0.15;
      const MIN_GLOW_SIZE = 150;
      const MAX_GLOW_SIZE = 500;
      const MAX_VELOCITY = 2000;

      const getCachedRect = (): DOMRect => {
        const now = performance.now();
        if (!cachedRect || (now - rectCacheTime) > RECT_CACHE_DURATION) {
          cachedRect = reportsCard.getBoundingClientRect();
          rectCacheTime = now;
        }
        return cachedRect;
      };

      const lerp = (start: number, end: number, factor: number): number => {
        return start + (end - start) * factor;
      };

      const calculateVelocity = (x: number, y: number, time: number): number => {
        if (lastTime === 0) {
          lastX = x;
          lastY = y;
          lastTime = time;
          return 0;
        }
        
        const deltaTime = (time - lastTime) / 1000;
        if (deltaTime <= 0) return currentVelocity;
        
        const deltaX = x - lastX;
        const deltaY = y - lastY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const instantVelocity = distance / deltaTime;
        
        velocityHistory.push(instantVelocity);
        if (velocityHistory.length > MAX_VELOCITY_HISTORY) {
          velocityHistory.shift();
        }
        
        const avgVelocity = velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length;
        
        lastX = x;
        lastY = y;
        lastTime = time;
        
        return avgVelocity;
      };

      const updateGlowSize = (velocity: number): void => {
        const normalizedVelocity = Math.min(velocity / MAX_VELOCITY, 1);
        const easedVelocity = Math.pow(normalizedVelocity, 0.6);
        targetSize = MIN_GLOW_SIZE + (MAX_GLOW_SIZE - MIN_GLOW_SIZE) * easedVelocity;
      };

      const animateGlow = () => {
        const now = performance.now();
        const timeSinceMove = now - lastMoveTime;
        
        currentX = lerp(currentX, targetX, SMOOTH_FOLLOW_SPEED);
        currentY = lerp(currentY, targetY, SMOOTH_FOLLOW_SPEED);
        currentSize = lerp(currentSize, targetSize, 0.1);
        
        // Clamp lerped values to card bounds to prevent overflow
        const rect = getCachedRect();
        const clampedX = Math.max(0, Math.min(currentX, rect.width));
        const clampedY = Math.max(0, Math.min(currentY, rect.height));
        
        reportsCard.style.setProperty('--card-cursor-x', `${clampedX}px`);
        reportsCard.style.setProperty('--card-cursor-y', `${clampedY}px`);
        reportsCard.style.setProperty('--card-glow-size', `${currentSize}px`);
        
        if (timeSinceMove < fadeOutDelay) {
          reportsCard.style.setProperty('--card-glow-opacity', '1');
          positionAnimationFrame = requestAnimationFrame(animateGlow);
        } else if (timeSinceMove < fadeOutDelay + fadeOutDuration) {
          const fadeProgress = (timeSinceMove - fadeOutDelay) / fadeOutDuration;
          const opacity = 1 - fadeProgress;
          reportsCard.style.setProperty('--card-glow-opacity', opacity.toString());
          positionAnimationFrame = requestAnimationFrame(animateGlow);
        } else {
          reportsCard.style.setProperty('--card-glow-opacity', '0');
          positionAnimationFrame = null;
        }
      };

      const handleMouseMove = (e: MouseEvent) => {
        const now = performance.now();
        const rect = getCachedRect();
        // Clamp relative position to card bounds to prevent overflow
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        
        targetX = x;
        targetY = y;
        currentVelocity = calculateVelocity(x, y, now);
        updateGlowSize(currentVelocity);
        lastMoveTime = now;
        
        if (!positionAnimationFrame) {
          positionAnimationFrame = requestAnimationFrame(animateGlow);
        }
      };

      const handleMouseLeave = () => {
        if (fadeAnimationFrame) {
          cancelAnimationFrame(fadeAnimationFrame);
          fadeAnimationFrame = null;
        }
        if (positionAnimationFrame) {
          cancelAnimationFrame(positionAnimationFrame);
          positionAnimationFrame = null;
        }
        
        cachedRect = null;
        lastMoveTime = 0;
        lastTime = 0;
        velocityHistory.length = 0;
        currentVelocity = 0;
        targetSize = MIN_GLOW_SIZE;
        
        reportsCard.style.setProperty('--card-glow-opacity', '0');
      };

      reportsCard.addEventListener('mousemove', handleMouseMove);
      reportsCard.addEventListener('mouseleave', handleMouseLeave);
    };

    setTimeout(setupElements, 100);
  }

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
          handleHttpError({ error: errorJson }, this.toastService, `Failed to download ${reportType} report.`);
        } catch (parseError) {
          handleHttpError(err, this.toastService, `Failed to download ${reportType} report and could not parse error details.`);
        }
      };
      reader.onerror = () => {
        handleHttpError(err, this.toastService, `Failed to read error response from ${reportType} report download.`);
      };
      reader.readAsText(err.error);
    } else {
      // Handle non-blob errors or blobs that aren't JSON
      this.handleApiError(err, reportType);
    }
  }

  /** Centralized handler for standard API errors */
  private handleApiError(err: any, reportType: 'sales' | 'inventory'): void {
    const defaultMessage = `Error downloading ${reportType} report. Please try again.`;
    handleHttpError(err, this.toastService, defaultMessage);
  }
}
