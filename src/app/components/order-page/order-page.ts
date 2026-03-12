import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, catchError } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';

import { Order, OrderStatus, OrderUpdateForm } from '../../models/order.model';
import { PaginationData } from '../../models/pagination.model';
import { OrderService, OrderFilters } from '../../services/order';
import { ToastService } from '../../services/toast';
import { handleHttpError } from '../../utils/error-handler';

@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-page.html',
  styleUrls: ['./order-page.css'],
  animations: [
    trigger('shellFadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        // Animate in after a brief delay
        animate('0.5s ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ]),
    trigger('fade', [
      // :enter (fade in)
      transition(':enter', [
        style({ opacity: 0 }),
        // Wait for skeleton to fade out (0.2s) then fade in content
        animate('0.3s 0.2s ease-out', style({ opacity: 1 }))
      ]),
      // :leave (fade out)
      transition(':leave', [
        // Smooth fade out
        animate('0.2s ease-in', style({ opacity: 0 }))
      ])
    ]),
    trigger('fadeIn', [
      // For content that fades in after skeleton
      transition(':enter', [
        style({ opacity: 0 }),
        // Wait for skeleton fade out, then fade in
        animate('0.3s 0.2s ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class OrderPageComponent implements OnInit, AfterViewInit {
  // ViewChild for glow effect (single elements)
  @ViewChild('tableCard') tableCard!: ElementRef<HTMLElement>;
  @ViewChild('controlsCard') controlsCard!: ElementRef<HTMLElement>;
  public isLoading = true;
  public showContent = false; // Controls when to show content after skeleton fade-out
  public orders: Order[] = [];
  public paginationData: PaginationData<Order> | null = null;

  public currentPage = 0;
  public pageSize = 10;

  public filters: OrderFilters = { startDate: null, endDate: null, status: null, orderId: null };
  public searchOrderId: string = '';

  public expandedOrderId: number | null = null;
  public actionLoadingId: number | null = null;
  public openActionMenuId: number | null = null;

  public OrderStatusEnum = OrderStatus;
  public orderStatusOptions = Object.values(OrderStatus);

  // Confirmation Modal State
  public isConfirmModalVisible = false;
  public isModalClosing = false;
  public orderToConfirm: Order | null = null;
  public confirmModalText = '';
  public confirmModalAction: 'invoice' | 'cancel' | null = null;
  public currentAction: 'invoice' | 'cancel' | null = null;

  constructor(
    private orderService: OrderService,
    private toastService: ToastService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.fetchOrders();
  }

  ngAfterViewInit(): void {
    // Set up border glow effect for tables and search inputs
    this.setupGlowEffect();
  }

  private setupGlowEffect(): void {
    // Wait for cards to be rendered, check multiple times if needed
    const setupCards = () => {
      // Try to get cards from ViewChild first, fallback to querySelector
      const tableCardEl = this.tableCard?.nativeElement || document.querySelector('.card.table-card') as HTMLElement;
      const controlsCardEl = this.controlsCard?.nativeElement || document.querySelector('.card.controls-card') as HTMLElement;

      const cards = [tableCardEl, controlsCardEl].filter(Boolean) as HTMLElement[];

      if (cards.length === 0) {
        // Retry if cards aren't ready yet
        setTimeout(setupCards, 100);
        return;
      }

      cards.forEach((card, index) => {
        if (!card) {
          return;
        }

        // Skip if already set up
        if ((card as any).__glowSetup) {
          return;
        }
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
            cachedRect = card.getBoundingClientRect();
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
          
          card.style.setProperty('--card-cursor-x', `${clampedX}px`);
          card.style.setProperty('--card-cursor-y', `${clampedY}px`);
          card.style.setProperty('--card-glow-size', `${currentSize}px`);
          
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
          
          card.style.setProperty('--card-glow-opacity', '0');
        };

        card.addEventListener('mousemove', handleMouseMove);
        card.addEventListener('mouseleave', handleMouseLeave);
      });
    };

    setTimeout(setupCards, 100);
    
    // Also set up after data loads
    setTimeout(() => {
      setupCards();
    }, 500);
    
    // Also set up after a longer delay to catch any late renders
    setTimeout(() => {
      setupCards();
    }, 1000);
  }

  fetchOrders(showToast: boolean = false): void {
    this.isLoading = true;
    this.showContent = false;
    
    // Clear orders immediately when starting to load to show skeleton placeholder
    // Keep paginationData to prevent layout shift in pagination controls
    this.orders = [];

    this.orderService.getOrders(this.filters, this.currentPage, this.pageSize)
      .subscribe({
        next: (data) => {
          // Store the data immediately
          this.orders = data.content;
          this.paginationData = data;
          
          // Start skeleton fade-out animation by setting isLoading to false
          // This triggers the skeleton's :leave animation
          this.isLoading = false;
          
          // Wait for skeleton fade-out animation to complete (0.2s) before showing content
          // This ensures skeleton is fully hidden before orders appear
          setTimeout(() => {
            this.showContent = true;
            // Re-setup glow effect after content is shown
            setTimeout(() => {
              this.setupGlowEffect();
            }, 300);

            if (showToast) this.toastService.showSuccess('Orders refreshed.');
          }, 200); // Match skeleton fade-out duration (0.2s)
        },
        error: (err) => {
          // Start skeleton fade-out
          this.isLoading = false;
          
          // Wait for skeleton fade-out before showing error state
          setTimeout(() => {
            this.orders = [];
            // Only clear paginationData on error if we don't have valid data
            if (!this.paginationData || this.paginationData.totalElements === 0) {
              this.paginationData = null;
            }
            this.showContent = true; // Show empty state
            this.handleApiError(err, 'load orders');
          }, 200);
        }
      });
  }

  onSearchInputChange(value: string): void {
    this.searchOrderId = value.replace(/[^0-9]/g, ''); // Allow only numbers
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!/[0-9]/.test(event.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
  }

  onSearchClick(): void {
    // Apply all filters including order ID search
    if (this.searchOrderId.trim()) {
      const id = parseInt(this.searchOrderId.trim(), 10);
      if (isNaN(id)) {
        this.toastService.showError('Invalid order ID.');
        return;
      }
      this.filters.orderId = id;
    } else {
      this.filters.orderId = null;
    }

    // Apply all filters
    this.onFilterChange(true);
  }

  onFilterChange(isFromSearch: boolean = false): void {
    if (!isFromSearch) {
      this.filters.orderId = null;
      this.searchOrderId = '';
    }
    // Only fetch if called from search button, not on individual filter changes
    if (isFromSearch) {
      this.currentPage = 0;
      this.fetchOrders();
    }
  }

  resetFilters(): void {
    this.filters = { startDate: null, endDate: null, status: null, orderId: null };
    this.searchOrderId = '';
    this.onFilterChange(true);
  }

  navigateToCreateOrder(): void {
    this.router.navigate(['/orders/new']);
  }

  navigateToEditOrder(event: Event, order: Order): void {
    event.stopPropagation();
    this.openActionMenuId = null; // Close action menu when navigating
    this.router.navigate(['/orders/edit', order.id]);
  }

  toggleOrderExpansion(orderId: number): void {
    this.expandedOrderId = this.expandedOrderId === orderId ? null : orderId;
    // Close action menu when expanding order
    if (this.expandedOrderId === orderId) {
      this.openActionMenuId = null;
    }
  }

  toggleActionMenu(event: Event, orderId: number): void {
    event.stopPropagation();
    this.openActionMenuId = this.openActionMenuId === orderId ? null : orderId;
  }

  closeActionMenu(): void {
    this.openActionMenuId = null;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close action menu when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest('.action-menu-mobile')) {
      this.openActionMenuId = null;
    }
  }

  openConfirmationModal(event: Event, order: Order, action: 'invoice' | 'cancel'): void {
    event.stopPropagation();
    this.orderToConfirm = order;
    this.confirmModalAction = action;
    this.openActionMenuId = null; // Close action menu when opening modal
    this.confirmModalText = `Are you sure you want to ${action} order #${order.id}?`;
    this.isConfirmModalVisible = true;
  }

  closeConfirmationModal(): void {
    if (this.actionLoadingId) return;
    this.isModalClosing = true;
    setTimeout(() => {
      this.isConfirmModalVisible = false;
      this.isModalClosing = false;
      this.orderToConfirm = null;
    }, 300);
  }

  confirmStatusChange(): void {
    if (!this.orderToConfirm || !this.confirmModalAction) return;

    const orderId = this.orderToConfirm.id;
    const action = this.confirmModalAction;

    this.actionLoadingId = orderId;
    this.currentAction = action;

    let actionObservable: Observable<any>;

    if (action === 'invoice') {
      actionObservable = this.orderService.generateInvoice(orderId);
    } else { // action === 'cancel'
      const form: OrderUpdateForm = {
        customerName: this.orderToConfirm.customerName || '',
        customerPhone: this.orderToConfirm.customerPhone || '',
        orderStatus: OrderStatus.CANCELLED
      };
      actionObservable = this.orderService.updateOrder(orderId, form);
    }

    actionObservable.pipe(
      finalize(() => {
        this.actionLoadingId = null;
        this.currentAction = null;
        this.closeConfirmationModal();
      })
    ).subscribe({
      next: (response) => {
        let successMessage = `Order #${orderId} has been successfully cancelled.`;
        if (action === 'invoice' && response?.message) {
          successMessage = response.message;
        }
        this.toastService.showSuccess(successMessage);
        this.fetchOrders(false); // Don't show refresh toast after invoicing/cancelling
      },
      error: (err) => this.handleApiError(err, action === 'cancel' ? 'cancel order' : 'invoice order')
    });
  }

  onDownloadInvoice(event: Event, orderId: number): void {
    event.stopPropagation();
    if (this.actionLoadingId) return;
    this.actionLoadingId = orderId;
    this.openActionMenuId = null; // Close action menu when downloading
    this.orderService.downloadInvoice(orderId)
      .pipe(finalize(() => this.actionLoadingId = null))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice-order-${orderId}.pdf`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          a.remove();
          this.toastService.showSuccess('Invoice download started.');
        },
        error: (err) => this.handleBlobError(err)
      });
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.fetchOrders();
  }

  get totalPagesArray(): number[] {
    return this.paginationData ? Array(this.paginationData.totalPages).fill(0).map((x, i) => i) : [];
  }

  get hasActiveFilters(): boolean {
    return !!(this.filters.startDate || this.filters.endDate || this.filters.status || this.filters.orderId || this.searchOrderId.trim());
  }

  private handleBlobError(err: HttpErrorResponse): void {
    if (err.error instanceof Blob && err.error.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const errorData = JSON.parse(e.target.result);
          handleHttpError({ error: errorData }, this.toastService, 'An unexpected error occurred processing the download.');
        } catch (parseError) {
          handleHttpError(err, this.toastService, 'An unexpected error occurred processing the download.');
        }
      };
      reader.onerror = () => {
        handleHttpError(err, this.toastService, 'Failed to read the error response.');
      };
      reader.readAsText(err.error);
    } else {
      handleHttpError(err, this.toastService);
    }
  }

  private handleApiError(err: any, context: string = 'load orders'): void {
    const defaultMessage = `Unable to ${context}. Please try again.`;
    handleHttpError(err, this.toastService, defaultMessage);
  }
}

