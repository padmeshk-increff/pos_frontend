import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { forkJoin, Observable, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { trigger, transition, style, animate } from '@angular/animations';
import { ProductService, ProductFilters } from '../../services/product';
import { InventoryService } from '../../services/inventory';
import { Product, ProductForm } from '../../models/product.model';
import { PaginationData } from '../../models/pagination.model';
import { ToastService } from '../../services/toast';
import { handleHttpError } from '../../utils/error-handler';

import { AuthService } from '../../services/auth.service';
import { Role } from '../../models/role.enum';

// Interface for the report file blob and name
interface ReportFile {
  blob: Blob;
  name: string;
}

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-page.html',
  styleUrls: ['./product-page.css'],
  animations: [
    trigger('shellFadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(15px)' }),
        // Fade in shell with no delay
        animate('0.5s ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ]),
    trigger('fade', [
      // :enter (fade in)
      transition(':enter', [
        style({ opacity: 0 }),
        // Smooth fade in
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
export class ProductPageComponent implements OnInit, AfterViewInit, OnDestroy {
  // --- STATE ---
  public products: Product[] = [];
  public isLoading = true;
  public showContent = false; // Controls when to show content after skeleton fade-out
  public isSaving = false;

  // Filter State
  public filters: ProductFilters = {
    searchTerm: null,
    clientName: null,
    category: null,
    minMrp: null,
    maxMrp: null,
    maxInventory: null
  };

  // Pagination State
  public paginationData: PaginationData<Product> | null = null;
  public currentPage = 0;
  public pageSize = 10; // Default page size

  // Add/Edit Modal State
  public isEditModalVisible = false;
  public productToEdit: Product | null = null;
  public originalProductState: Product | null = null;
  public isAddModalVisible = false;
  public newProduct: ProductForm | null = null;
  public isModalClosing = false;

  // Upload Modal State
  public isUploadModalVisible = false;
  public uploadType: 'product' | 'inventory' | null = null;
  public uploadFile: File | null = null;
  public isUploadingProduct = false;
  public isUploadingInventory = false;
  public uploadReport: ReportFile | null = null;

  // --- NEW: Header constants ---
  // Made public so the template can access them
  public readonly productHeaders = ["Barcode", "Name", "Category", "MRP", "ClientName"];
  public readonly inventoryHeaders = ["Barcode", "Quantity"];
  // --- END NEW ---
  public userRole: Role | null = null;
  public RoleEnum = Role;
  // ViewChild to get the file input from the template
  @ViewChild('uploadFileInput') uploadFileInputRef: ElementRef<HTMLInputElement> | undefined;
  
  // ViewChildren for glow effect
  @ViewChildren('tableCard') tableCards!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('searchInput') searchInputs!: QueryList<ElementRef<HTMLElement>>;


  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private productService: ProductService,
    private inventoryService: InventoryService,
    private toastService: ToastService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.userRole = this.authService.currentUserValue?.role || null;
    
    // Check for query parameters (e.g., from dashboard low stock link)
    this.route.queryParams.subscribe(params => {
      if (params['lowStock'] === 'true') {
        // Filter for low stock items (inventory <= 50)
        this.filters.maxInventory = 50;
      } else {
        // Clear maxInventory filter if not coming from low stock link
        this.filters.maxInventory = null;
      }
      this.currentPage = 0; // Reset to first page when query params change
      this.fetchProducts();
    });
  }

  ngAfterViewInit(): void {
    // Set up border glow effect for tables and search inputs
    this.setupGlowEffect();
  }

  ngOnDestroy(): void {
    // Remove inline overflow style to restore CSS defaults
    document.body.style.overflow = '';
  }

  private setupGlowEffect(): void {
    const setupElements = () => {
      // Get all table cards, controls cards, and search inputs
      const tableCards = document.querySelectorAll('.table-card');
      const controlsCards = document.querySelectorAll('.controls-card');
      const searchInputs = document.querySelectorAll('.filter-input, .search-input');

      // Setup glow effect for controls cards (filter container)
      controlsCards.forEach((card) => {
        if ((card as any).__glowSetup) return;
        (card as any).__glowSetup = true;

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
            cachedRect = (card as HTMLElement).getBoundingClientRect();
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
          
          (card as HTMLElement).style.setProperty('--card-cursor-x', `${clampedX}px`);
          (card as HTMLElement).style.setProperty('--card-cursor-y', `${clampedY}px`);
          (card as HTMLElement).style.setProperty('--card-glow-size', `${currentSize}px`);
          
          if (timeSinceMove < fadeOutDelay) {
            (card as HTMLElement).style.setProperty('--card-glow-opacity', '1');
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else if (timeSinceMove < fadeOutDelay + fadeOutDuration) {
            const fadeProgress = (timeSinceMove - fadeOutDelay) / fadeOutDuration;
            const opacity = 1 - fadeProgress;
            (card as HTMLElement).style.setProperty('--card-glow-opacity', opacity.toString());
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else {
            (card as HTMLElement).style.setProperty('--card-glow-opacity', '0');
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
          
          (card as HTMLElement).style.setProperty('--card-glow-opacity', '0');
        };

        card.addEventListener('mousemove', handleMouseMove as EventListener);
        card.addEventListener('mouseleave', handleMouseLeave);
      });

      // Setup glow effect for table cards
      tableCards.forEach((card) => {
        if ((card as any).__glowSetup) return;
        (card as any).__glowSetup = true;

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
            cachedRect = (card as HTMLElement).getBoundingClientRect();
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
          
          (card as HTMLElement).style.setProperty('--card-cursor-x', `${clampedX}px`);
          (card as HTMLElement).style.setProperty('--card-cursor-y', `${clampedY}px`);
          (card as HTMLElement).style.setProperty('--card-glow-size', `${currentSize}px`);
          
          if (timeSinceMove < fadeOutDelay) {
            (card as HTMLElement).style.setProperty('--card-glow-opacity', '1');
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else if (timeSinceMove < fadeOutDelay + fadeOutDuration) {
            const fadeProgress = (timeSinceMove - fadeOutDelay) / fadeOutDuration;
            const opacity = 1 - fadeProgress;
            (card as HTMLElement).style.setProperty('--card-glow-opacity', opacity.toString());
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else {
            (card as HTMLElement).style.setProperty('--card-glow-opacity', '0');
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
          
          (card as HTMLElement).style.setProperty('--card-glow-opacity', '0');
        };

        card.addEventListener('mousemove', handleMouseMove as EventListener);
        card.addEventListener('mouseleave', handleMouseLeave);
      });

      // Setup glow effect for search inputs
      searchInputs.forEach((input) => {
        if ((input as any).__glowSetup) return;
        (input as any).__glowSetup = true;

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
            cachedRect = (input as HTMLElement).getBoundingClientRect();
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
          
          // Clamp lerped values to input bounds to prevent overflow
          const rect = getCachedRect();
          const clampedX = Math.max(0, Math.min(currentX, rect.width));
          const clampedY = Math.max(0, Math.min(currentY, rect.height));
          
          (input as HTMLElement).style.setProperty('--card-cursor-x', `${clampedX}px`);
          (input as HTMLElement).style.setProperty('--card-cursor-y', `${clampedY}px`);
          (input as HTMLElement).style.setProperty('--card-glow-size', `${currentSize}px`);
          
          if (timeSinceMove < fadeOutDelay) {
            (input as HTMLElement).style.setProperty('--card-glow-opacity', '1');
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else if (timeSinceMove < fadeOutDelay + fadeOutDuration) {
            const fadeProgress = (timeSinceMove - fadeOutDelay) / fadeOutDuration;
            const opacity = 1 - fadeProgress;
            (input as HTMLElement).style.setProperty('--card-glow-opacity', opacity.toString());
            positionAnimationFrame = requestAnimationFrame(animateGlow);
          } else {
            (input as HTMLElement).style.setProperty('--card-glow-opacity', '0');
            positionAnimationFrame = null;
          }
        };

        const handleMouseMove = (e: Event) => {
          const mouseEvent = e as MouseEvent;
          const now = performance.now();
          const rect = getCachedRect();
          // Clamp relative position to input bounds to prevent overflow
          const x = Math.max(0, Math.min(mouseEvent.clientX - rect.left, rect.width));
          const y = Math.max(0, Math.min(mouseEvent.clientY - rect.top, rect.height));
          
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
          
          (input as HTMLElement).style.setProperty('--card-glow-opacity', '0');
        };

        input.addEventListener('mousemove', handleMouseMove);
        input.addEventListener('mouseleave', handleMouseLeave);
      });
    };

    // Initial setup
    setTimeout(setupElements, 100);
    
    // Re-setup after data loads
    setTimeout(setupElements, 500);
    
    // Watch for changes in table cards and search inputs
    this.tableCards?.changes.subscribe(() => {
      setTimeout(setupElements, 100);
    });
  }

  // --- DATA FETCHING & FILTERING ---
  fetchProducts(): void {
    this.isLoading = true;
    this.showContent = false;

    // Clear products array to show skeleton placeholder during pagination
    // Keep paginationData to prevent layout shift in pagination controls
    this.products = [];

    const apiFilters: ProductFilters = {
      searchTerm: this.filters.searchTerm?.trim() || null,
      clientName: this.filters.clientName?.trim() || null,
      category: this.filters.category?.trim() || null,
      minMrp: this.isValidNumber(this.filters.minMrp) ? Number(this.filters.minMrp) : null,
      maxMrp: this.isValidNumber(this.filters.maxMrp) ? Number(this.filters.maxMrp) : null,
      maxInventory: this.filters.maxInventory != null ? Number(this.filters.maxInventory) : null,
    };

    if (apiFilters.minMrp != null && apiFilters.maxMrp != null && apiFilters.minMrp > apiFilters.maxMrp) {
      this.toastService.showError('Min MRP cannot be greater than Max MRP.');
      this.isLoading = false;
      return;
    }

    this.productService.getFilteredProducts(apiFilters, this.currentPage, this.pageSize)
      .subscribe({
        next: (data) => {
          // Store the data temporarily
          const loadedData = data;
          
          // Start skeleton fade-out animation by setting isLoading to false
          this.isLoading = false;
          
          // Wait for skeleton fade-out animation to complete (0.2s) before showing content
          setTimeout(() => {
            this.products = loadedData.content;
            this.paginationData = loadedData;
            if (loadedData.totalPages > 0 && this.currentPage >= loadedData.totalPages) {
              this.currentPage = Math.max(0, loadedData.totalPages - 1);
            }
            this.showContent = true;
            // Re-setup glow effect after content is shown
            setTimeout(() => this.setupGlowEffect(), 100);
          }, 200); // Match skeleton fade-out duration (0.2s)
        },
        error: (err) => {
          this.isLoading = false;
          setTimeout(() => {
            this.products = [];
            // Only clear paginationData on error if we don't have valid data
            if (!this.paginationData || this.paginationData.totalElements === 0) {
            this.paginationData = null;
            }
            this.showContent = true; // Show empty state
            this.handleApiError(err, 'load products');
          }, 200);
        }
      });
  }

  applyFilters(): void {
    this.currentPage = 0; // Reset to first page when filters change
    this.fetchProducts();
  }

  resetFilters(): void {
    this.filters = { searchTerm: null, clientName: null, category: null, minMrp: null, maxMrp: null, maxInventory: null };
    this.currentPage = 0;
    // Clear query parameters when resetting
    this.router.navigate([], { queryParams: {} });
    this.fetchProducts(); // Fetch after resetting
  }

  // --- PAGINATION ---
  goToPage(page: number): void {
    if (page < 0 || (this.paginationData && page >= this.paginationData.totalPages)) {
      return; // Prevent going out of bounds
    }
    this.currentPage = page;
    this.fetchProducts();
  }

  // --- MRP INPUT VALIDATION ---
  validateMrpInput(field: 'minMrp' | 'maxMrp', value: string | number | null): void {
    if (value === null || value === '') {
      this.filters[field] = null;
      return;
    }

    let stringValue = String(value);

    // Regex to remove invalid characters (anything not a number or a dot)
    let numericValue = stringValue.replace(/[^0-9.]/g, '');

    // Ensure only one dot
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      numericValue = parts[0] + '.' + parts.slice(1).join('');
    }

    // Truncate to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      numericValue = parts[0] + '.' + parts[1].substring(0, 2);
    }

    const finalValue = (numericValue && numericValue !== '.') ? Number(numericValue) : null;

    // Only update if the model value is different, to prevent infinite loops
    if (this.filters[field] !== finalValue) {
      // Use setTimeout to update the value in the next tick
      setTimeout(() => {
        this.filters[field] = finalValue;
      });
    }
  }


  // Helper to check if a value is a valid number
  private isValidNumber(value: any): boolean {
    if (value === null || value === undefined || value === '') return false;
    const num = Number(value);
    return !isNaN(num) && num >= 0;
  }


  // --- ADD/EDIT MODAL CONTROLS ---
  openAddModal(): void {
    document.body.style.overflow = 'hidden';
    this.newProduct = { name: '', barcode: '', category: '', mrp: null as any, clientId: null as any, imageUrl: '' };
    this.isAddModalVisible = true;
    this.isModalClosing = false;
  }

  closeAddModal(): void {
    if (this.isModalClosing || this.isSaving) return;
    this.isModalClosing = true;
    setTimeout(() => {
      // Remove inline style instead of setting to 'auto' to avoid conflicts with CSS
      document.body.style.overflow = '';
      this.isAddModalVisible = false;
      this.isModalClosing = false;
      this.newProduct = null;
    }, 300);
  }

  openEditModal(product: Product): void {
    document.body.style.overflow = 'hidden';
    this.productToEdit = JSON.parse(JSON.stringify(product));
    this.originalProductState = product;
    this.isEditModalVisible = true;
    this.isModalClosing = false;
  }

  closeEditModal(): void {
    if (this.isModalClosing || this.isSaving) return;
    this.isModalClosing = true;
    setTimeout(() => {
      // Remove inline style instead of setting to 'auto' to avoid conflicts with CSS
      document.body.style.overflow = '';
      this.isEditModalVisible = false;
      this.isModalClosing = false;
      this.productToEdit = null;
      this.originalProductState = null;
    }, 300);
  }

  closeModalOnBackdropClick(event: MouseEvent, modalType: 'edit' | 'add' | 'upload'): void {
    if (this.isSaving || this.isUploadingProduct || this.isUploadingInventory) return;
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      switch (modalType) {
        case 'edit': this.closeEditModal(); break;
        case 'add': this.closeAddModal(); break;
        case 'upload': this.closeUploadModal(); break;
      }
    }
  }

  // --- DATA MANIPULATION LOGIC ---
  addProduct(): void {
    if (!this.newProduct || this.isSaving) return;
    if (!this.newProduct.name.trim() || !this.newProduct.barcode.trim() || !this.newProduct.category.trim()) {
      this.toastService.showError('Name, Barcode, and Category are required.');
      return;
    }
    if (this.newProduct.mrp <= 0 || this.newProduct.clientId <= 0) {
      this.toastService.showError('MRP and Client ID must be positive numbers.');
      return;
    }

    this.isSaving = true;
    const clientProductForm = this.newProduct;
    let addedSuccessfully = false;

    this.productService.createProduct(clientProductForm)
      .pipe(finalize(() => {
        // finalize runs after next/error and after the observable completes
        this.isSaving = false;
        if (addedSuccessfully) {
          // close modal only after isSaving has been cleared
          this.closeAddModal();
        }
      }))
      .subscribe({
        next: (newProd) => {
          addedSuccessfully = true;
          this.toastService.showSuccess('Product added successfully!');
          // Keep page consistent: add locally then refresh filtered results
          this.products.push(newProd);
          this.products.sort((a, b) => a.id - b.id);
          this.applyFilters();
          // DO NOT call closeAddModal() here because isSaving is still true
        },
        error: (err) => this.handleApiError(err, 'add product')
      });
  }


  saveProductChanges(): void {
    if (!this.productToEdit || !this.originalProductState || this.isSaving) return;

    if (!this.productToEdit.mrp || this.productToEdit.mrp <= 0) {
      this.toastService.showError("MRP must be a positive number.");
      return;
    }
    if (this.productToEdit.quantity === null || this.productToEdit.quantity < 0) {
      this.toastService.showError("Inventory must be 0 or greater.");
      return;
    }

    this.isSaving = true;
    let updatedSuccessfully = false;
    const observables: Observable<any>[] = [];

    const productForm: ProductForm = {
      name: this.productToEdit.name,
      barcode: this.productToEdit.barcode,
      category: this.productToEdit.category,
      mrp: this.productToEdit.mrp,
      imageUrl: this.productToEdit.imageUrl,
      clientId: this.productToEdit.clientId
    };

    // Check if any product field has changed (name, category, mrp, imageUrl)
    const productChanged = 
      productForm.name !== this.originalProductState.name ||
      productForm.category !== this.originalProductState.category ||
      productForm.mrp !== this.originalProductState.mrp ||
      productForm.imageUrl !== this.originalProductState.imageUrl;
    
    if (productChanged) {
      observables.push(this.productService.updateProduct(this.productToEdit.id, productForm));
    }

    if (this.productToEdit.quantity !== this.originalProductState.quantity) {
      observables.push(this.inventoryService.updateInventory(this.productToEdit.id, this.productToEdit.quantity));
    }

    if (observables.length === 0) {
      this.toastService.showSuccess('No changes were made.');
      this.isSaving = false;
      this.closeEditModal();
      return;
    }

    // --- MODIFIED: Apply same finalize logic as addProduct ---
    forkJoin(observables)
      .pipe(finalize(() => {
        this.isSaving = false;
        if (updatedSuccessfully) { // <-- Check flag
          this.closeEditModal(); // <-- Close modal here
        }
      }))
      .subscribe({
        next: () => {
          updatedSuccessfully = true; // <-- Set flag on success
          this.toastService.showSuccess('Product updated successfully!');
          this.fetchProducts();
          // DO NOT close modal here anymore
        },
        error: (err) => this.handleApiError(err, 'update product') // <-- On error, flag stays false, modal stays open
      });
  }

  // --- UPLOAD MODAL CONTROLS & LOGIC ---
  openUploadModal(type: 'product' | 'inventory'): void {
    this.uploadType = type;
    this.uploadFile = null;
    this.uploadReport = null;
    this.isUploadModalVisible = true;
    this.isModalClosing = false;
    document.body.style.overflow = 'hidden';
  }

  closeUploadModal(): void {
    if (this.isModalClosing || this.isUploadingProduct || this.isUploadingInventory) return;
    this.isModalClosing = true;
    setTimeout(() => {
      // Remove inline style instead of setting to 'auto' to avoid conflicts with CSS
      document.body.style.overflow = '';
      this.isUploadModalVisible = false;
      this.isModalClosing = false;
      this.uploadType = null;
      this.uploadFile = null;
      this.uploadReport = null;
    }, 300);
  }

  onUploadFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.uploadFile = (input.files && input.files.length) ? input.files[0] : null;
    this.uploadReport = null;
  }

  uploadFileFromModal(): void {
    const fileInput = this.uploadFileInputRef?.nativeElement;
    if (!this.uploadFile || !this.uploadType || !fileInput) {
      this.toastService.showError("File input not found.");
      return;
    }
    if (this.uploadType === 'product') {
      this.uploadProductTsv(fileInput);
    } else {
      this.uploadInventoryTsv(fileInput);
    }
  }

  uploadProductTsv(fileInputRef: HTMLInputElement): void {
    if (!this.uploadFile || this.isUploadingProduct) return;
    this.isUploadingProduct = true;

    this.productService.uploadProductsTsv(this.uploadFile)
      .pipe(finalize(() => this.isUploadingProduct = false))
      .subscribe({
        next: (blob) => {
          this.uploadReport = { blob, name: 'product-upload-report.tsv' };
          this.toastService.showSuccess('Product upload processed. Report ready.');
          this.fetchProducts();
          this.uploadFile = null;
          fileInputRef.value = '';
        },
        error: (err) => this.handleBlobError(err)
      });
  }

  uploadInventoryTsv(fileInputRef: HTMLInputElement): void {
    if (!this.uploadFile || this.isUploadingInventory) return;
    this.isUploadingInventory = true;

    this.inventoryService.uploadInventoryTsv(this.uploadFile)
      .pipe(finalize(() => this.isUploadingInventory = false))
      .subscribe({
        next: (blob) => {
          this.uploadReport = { blob, name: 'inventory-upload-report.tsv' };
          this.toastService.showSuccess('Inventory upload processed. Report ready.');
          this.fetchProducts();
          this.uploadFile = null;
          fileInputRef.value = '';
        },
        error: (err) => this.handleBlobError(err)
      });
  }


  downloadReport(): void {
    if (!this.uploadReport) return;
    const url = window.URL.createObjectURL(this.uploadReport.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.uploadReport.name;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  }

  clearReportAndResetModal(): void {
    this.uploadReport = null;
    this.uploadFile = null;
    if (this.uploadFileInputRef?.nativeElement) {
      this.uploadFileInputRef.nativeElement.value = '';
    }
  }

  // --- Download Sample TSV ---
  downloadSampleTsv(): void {
    let tsvContent: string; // Changed variable name
    let filename: string;

    if (this.uploadType === 'product') {
      // Create headers (row 1)
      const headers = this.productHeaders.join("\t");
      // Create an example data row (row 2)
      const exampleRow = "BC12345\tSample Product\tSample Category\t199.99\tSample Client";

      tsvContent = headers + "\n" + exampleRow; // Combine headers and data
      filename = "product_master_sample.tsv";

    } else if (this.uploadType === 'inventory') {
      // Create headers (row 1)
      const headers = this.inventoryHeaders.join("\t");
      // Create an example data row (row 2)
      const exampleRow = "BC12345\t50";

      tsvContent = headers + "\n" + exampleRow; // Combine headers and data
      filename = "inventory_sample.tsv";

    } else {
      return; // Should not happen
    }

    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    this.toastService.showSuccess(`Downloading ${filename}`);
  }


  // --- ERROR HANDLING & UTILITIES ---
  private handleBlobError(err: HttpErrorResponse): void {
    if (err.error instanceof Blob && err.error.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const errorData = JSON.parse(e.target.result);
          handleHttpError({ error: errorData }, this.toastService, 'An unexpected error occurred processing the upload report.');
        } catch (parseError) {
          handleHttpError(err, this.toastService, 'An unexpected error occurred processing the upload report.');
        }
      };
      reader.onerror = () => {
        handleHttpError(err, this.toastService, 'Failed to read the error report.');
      };
      reader.readAsText(err.error);
    } else {
      handleHttpError(err, this.toastService);
    }
  }

  private handleApiError(err: any, context: string = 'loading products'): void {
    const defaultMessage = `Unable to ${context}. Please try again.`;
    handleHttpError(err, this.toastService, defaultMessage);
  }

  onDecimalKeyDown(event: KeyboardEvent): void {
    const { key, target } = event;
    const currentValue = (target as HTMLInputElement).value;

    if (
      !/[0-9]/.test(key) &&
      !(key === '.' && !currentValue.includes('.')) &&
      !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
    ) {
      event.preventDefault(); // Block invalid key
    }
  }

  /** Allows only numbers and control keys. */
  onNumericKeyDown(event: KeyboardEvent): void {
    const { key } = event;

    if (
      !/[0-9]/.test(key) &&
      !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
    ) {
      event.preventDefault(); // Block invalid key
    }
  }

  // --- ngModelChange handlers for parsing string input to number/null ---

  onEditMrpChange(value: string): void {
    if (!this.productToEdit) return;
    this.productToEdit.mrp = (value && value !== '.') ? parseFloat(value) : null as any;
  }

  onEditInventoryChange(value: string): void {
    if (!this.productToEdit) return;
    this.productToEdit.quantity = (value !== '') ? parseInt(value, 10) : null as any;
  }

  onNewMrpChange(value: string): void {
    if (!this.newProduct) return;
    this.newProduct.mrp = (value && value !== '.') ? parseFloat(value) : null as any;
  }

  onNewClientIdChange(value: string): void {
    if (!this.newProduct) return;
    this.newProduct.clientId = (value !== '') ? parseInt(value, 10) : null as any;
  }


  // --- END NEW ---
  trackProductById(index: number, product: Product): number {
    return product.id;
  }
}

