import { Component, OnInit, AfterViewInit, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common'; // Import DecimalPipe
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ReportService } from '../../services/report'; // Use ReportService
import { DashboardSummary, KpiData, LowStockAlert } from '../../models/dashboard.model'; // Import new models
import { ToastService } from '../../services/toast'; // For error handling
import { trigger, transition, style, animate } from '@angular/animations';
import { handleHttpError } from '../../utils/error-handler';

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
export class HomePageComponent implements OnInit, AfterViewInit {
  public isLoading = true;
  public summaryData: DashboardSummary | null = null;
  
  @ViewChildren('kpiCard') kpiCards!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('actionCard') actionCards!: QueryList<ElementRef<HTMLElement>>;

  // Convenience getters for template binding
  public get todaySales(): KpiData | null { return this.summaryData?.todaySales ?? null; }
  public get todayOrders(): KpiData | null { return this.summaryData?.todayOrders ?? null; }
  public get averageOrderValue(): KpiData | null { return this.summaryData?.averageOrderValue ?? null; }
  public get lowStockItems(): LowStockAlert[] { return this.summaryData?.lowStockAlerts ?? []; }

  constructor(
    private router: Router,
    private reportService: ReportService,
    private toastService: ToastService // Inject ToastService
  ) { }

  ngOnInit(): void {
    this.fetchSummaryData();
  }

  ngAfterViewInit(): void {
    // Set up mouse move tracking for border glow effect
    this.setupCardGlowEffect();
  }

  private setupCardGlowEffect(): void {
    // Wait for cards to be rendered, check multiple times if needed
    const setupCards = () => {
      const allCards: ElementRef<HTMLElement>[] = [
        ...this.kpiCards.toArray(),
        ...this.actionCards.toArray()
      ];

      if (allCards.length === 0) {
        // Retry if cards aren't ready yet
        setTimeout(setupCards, 100);
        return;
      }

      allCards.forEach((cardRef, index) => {
        const card = cardRef.nativeElement;
        if (!card) return;

        // Skip if already set up
        if ((card as any).__glowSetup) return;
        (card as any).__glowSetup = true;

        let lastMoveTime = 0;
        let fadeAnimationFrame: number | null = null;
        let positionAnimationFrame: number | null = null;
        let cachedRect: DOMRect | null = null;
        let rectCacheTime = 0;
        
        // Smooth following state
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;
        
        // Velocity tracking for size calculation
        let lastX = 0;
        let lastY = 0;
        let lastTime = 0;
        const velocityHistory: number[] = [];
        const MAX_VELOCITY_HISTORY = 5;
        let currentVelocity = 0;
        
        // Glow size state
        let targetSize = 200; // Base size in px
        let currentSize = 200;
        
        const fadeOutDelay = 200; // ms after movement stops before starting fade
        const fadeOutDuration = 300; // ms for fade out animation
        const RECT_CACHE_DURATION = 100; // Cache rect for 100ms
        const SMOOTH_FOLLOW_SPEED = 0.15; // Lerp speed (0-1, higher = faster)
        const MIN_GLOW_SIZE = 150; // Minimum glow size when not moving
        const MAX_GLOW_SIZE = 500; // Maximum glow size at high speed
        const MAX_VELOCITY = 2000; // Maximum velocity for size calculation (px/s)

        // Cache bounding rect to avoid expensive recalculations
        const getCachedRect = (): DOMRect => {
          const now = performance.now();
          if (!cachedRect || (now - rectCacheTime) > RECT_CACHE_DURATION) {
            cachedRect = card.getBoundingClientRect();
            rectCacheTime = now;
          }
          return cachedRect;
        };

        // Efficient linear interpolation
        const lerp = (start: number, end: number, factor: number): number => {
          return start + (end - start) * factor;
        };

        // Calculate velocity efficiently
        const calculateVelocity = (x: number, y: number, time: number): number => {
          if (lastTime === 0) {
            lastX = x;
            lastY = y;
            lastTime = time;
            return 0;
          }
          
          const deltaTime = (time - lastTime) / 1000; // Convert to seconds
          if (deltaTime <= 0) return currentVelocity;
          
          const deltaX = x - lastX;
          const deltaY = y - lastY;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          const instantVelocity = distance / deltaTime;
          
          // Smooth velocity using history
          velocityHistory.push(instantVelocity);
          if (velocityHistory.length > MAX_VELOCITY_HISTORY) {
            velocityHistory.shift();
          }
          
          // Calculate average velocity
          const avgVelocity = velocityHistory.reduce((a, b) => a + b, 0) / velocityHistory.length;
          
          lastX = x;
          lastY = y;
          lastTime = time;
          
          return avgVelocity;
        };

        // Update glow size based on velocity
        const updateGlowSize = (velocity: number): void => {
          // Normalize velocity (0-1)
          const normalizedVelocity = Math.min(velocity / MAX_VELOCITY, 1);
          // Use easing function for smoother size transitions
          const easedVelocity = Math.pow(normalizedVelocity, 0.6);
          // Calculate target size
          targetSize = MIN_GLOW_SIZE + (MAX_GLOW_SIZE - MIN_GLOW_SIZE) * easedVelocity;
        };

        // Smooth animation loop for position and size
        const animateGlow = () => {
          const now = performance.now();
          const timeSinceMove = now - lastMoveTime;
          
          // Smoothly interpolate position
          currentX = lerp(currentX, targetX, SMOOTH_FOLLOW_SPEED);
          currentY = lerp(currentY, targetY, SMOOTH_FOLLOW_SPEED);
          
          // Smoothly interpolate size
          currentSize = lerp(currentSize, targetSize, 0.1);
          
          // Clamp lerped values to card bounds to prevent overflow
          const rect = getCachedRect();
          const clampedX = Math.max(0, Math.min(currentX, rect.width));
          const clampedY = Math.max(0, Math.min(currentY, rect.height));
          
          // Update CSS variables
          card.style.setProperty('--card-cursor-x', `${clampedX}px`);
          card.style.setProperty('--card-cursor-y', `${clampedY}px`);
          card.style.setProperty('--card-glow-size', `${currentSize}px`);
          
          // Handle opacity based on time since last move
          if (timeSinceMove < fadeOutDelay) {
            card.style.setProperty('--card-glow-opacity', '1');
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else if (timeSinceMove < fadeOutDelay + fadeOutDuration) {
            const fadeProgress = (timeSinceMove - fadeOutDelay) / fadeOutDuration;
            const opacity = 1 - fadeProgress;
            card.style.setProperty('--card-glow-opacity', opacity.toString());
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else {
            card.style.setProperty('--card-glow-opacity', '0');
            positionAnimationFrame = null;
          }
        };

        const handleMouseMove = (e: MouseEvent) => {
          const now = performance.now();
          const rect = getCachedRect();
          // Clamp relative position to card bounds to prevent overflow
          const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
          const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
          
          // Update target position
          targetX = x;
          targetY = y;
          
          // Calculate velocity
          currentVelocity = calculateVelocity(x, y, now);
          
          // Update glow size based on velocity
          updateGlowSize(currentVelocity);
          
          // Update last movement time
          lastMoveTime = now;
          
          // Start animation loop if not already running
          if (!positionAnimationFrame) {
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          }
        };

        const handleMouseLeave = () => {
          // Stop animations and immediately hide glow
          if (fadeAnimationFrame) {
            cancelAnimationFrame(fadeAnimationFrame);
            fadeAnimationFrame = null;
          }
          if (positionAnimationFrame) {
            cancelAnimationFrame(positionAnimationFrame);
            positionAnimationFrame = null;
          }
          
          // Reset state
          cachedRect = null;
          lastMoveTime = 0;
          lastTime = 0;
          velocityHistory.length = 0;
          currentVelocity = 0;
          targetSize = MIN_GLOW_SIZE;
          
          card.style.setProperty('--card-glow-opacity', '0');
        };

        card.addEventListener('mousemove', handleMouseMove);
        card.addEventListener('mouseleave', handleMouseLeave);
      });
    };

    setTimeout(setupCards, 100);
    
    // Also set up after data loads
    if (this.summaryData) {
      setTimeout(setupCards, 300);
    }
  }

  fetchSummaryData(): void {
    this.isLoading = true;
    this.reportService.getSummaryData()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (data) => {
          this.summaryData = data;
          // Set up glow effect after data loads
          setTimeout(() => this.setupCardGlowEffect(), 200);
        },
        error: (err) => {
          this.summaryData = null; // Clear data on error
          handleHttpError(err, this.toastService, 'Unable to load dashboard summary. Please try again.');
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

  navigateToLowStockProducts(): void {
    // Navigate to products page with lowStock query parameter
    this.router.navigate(['/products'], { queryParams: { lowStock: 'true' } });
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
