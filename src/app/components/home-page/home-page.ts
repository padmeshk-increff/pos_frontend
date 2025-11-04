import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common'; // Import DecimalPipe
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ReportService } from '../../services/report'; // Use ReportService
import { DashboardSummary, KpiData, LowStockAlert } from '../../models/dashboard.model'; // Import new models
import { ToastService } from '../../services/toast'; // For error handling
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, DecimalPipe], // Add DecimalPipe for formatting percentages
  templateUrl: './home-page.html',
  styleUrls: ['./home-page.css'],
  animations: [
    trigger('fade', [
      // :enter (fade in)
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        // Slower fade-in to feel smooth
        animate('0.6s ease-out', 
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ]),
      
      // :leave (fade out)
      transition(':leave', [
        // Faster fade-out
        animate('0.3s ease-in', 
          style({ opacity: 0 })
        )
      ])
    ])
  ]
})
export class HomePageComponent implements OnInit {
  isLoading = true;
  summaryData: DashboardSummary | null = null;

  // Convenience getters for template binding
  get todaySales(): KpiData | null { return this.summaryData?.todaySales ?? null; }
  get todayOrders(): KpiData | null { return this.summaryData?.todayOrders ?? null; }
  get averageOrderValue(): KpiData | null { return this.summaryData?.averageOrderValue ?? null; }
  get lowStockItems(): LowStockAlert[] { return this.summaryData?.lowStockAlerts ?? []; }

  constructor(
    private router: Router,
    private reportService: ReportService,
    private toastService: ToastService // Inject ToastService
  ) { }

  ngOnInit(): void {
    this.fetchSummaryData();
  }

  fetchSummaryData(): void {
    this.isLoading = true;
    this.reportService.getSummaryData()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (data) => {
          this.summaryData = data;
          console.log("Dashboard Summary Data:", data);
        },
        error: (err) => {
          this.summaryData = null; // Clear data on error
          this.toastService.showError('Could not load dashboard summary.');
          console.error("Error loading dashboard summary:", err);
        }
      });
  }

  // --- Quick Action Navigation ---
  navigateToNewOrder(): void {
    this.router.navigate(['/orders/new']);
  }

  navigateToProducts(): void {
    this.router.navigate(['/products']);
  }

  navigateToReports(): void {
    this.router.navigate(['/reports']);
  }

  navigateToClients(): void {
    this.router.navigate(['/clients']);
  }

  // --- Template Helpers ---
  getChangeIndicator(changePercent: number | undefined): 'positive' | 'negative' | 'neutral' {
    if (changePercent === undefined || changePercent === null || changePercent === 0) {
      return 'neutral';
    }
    return changePercent > 0 ? 'positive' : 'negative';
  }

  getChangeIcon(changePercent: number | undefined): string {
    const change = this.getChangeIndicator(changePercent);
    if (change === 'positive') return '▲'; // Up arrow
    if (change === 'negative') return '▼'; // Down arrow
    return '―'; // Dash for neutral
  }
}
