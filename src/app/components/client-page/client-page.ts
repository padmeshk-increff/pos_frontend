import { Component, OnInit, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { A11yModule } from '@angular/cdk/a11y';

import { trigger, transition, style, animate } from '@angular/animations';
import { ClientService } from '../../services/client';
import { Client, ClientForm } from '../../models/client.model';
import { ToastService } from '../../services/toast';
import { PaginationData } from '../../models/pagination.model'; // Import pagination model
import { handleHttpError } from '../../utils/error-handler';

@Component({
  selector: 'app-client-page',
  standalone: true,
  imports: [FormsModule, CommonModule, A11yModule],
  templateUrl: './client-page.html',
  styleUrl: './client-page.css',
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
export class ClientPageComponent implements OnInit, AfterViewInit {
  // ViewChildren for glow effect
  @ViewChildren('tableCard') tableCards!: QueryList<ElementRef<HTMLElement>>;
  // --- STATE ---
  public clients: Client[] = []; // This list is now just for the current page
  public isLoading = true;
  public showContent = false; // Controls when to show content after skeleton fade-out
  public isSaving = false;
  public searchTerm: string = ''; // The value in the search box
  public activeSearchTerm: string = ''; // The filter currently applied


  // --- Pagination State ---
  public paginationData: PaginationData<Client> | null = null;
  public currentPage = 0;
  public pageSize = 10; // Or your desired default

  // --- Inline Edit State ---
  public editingClientId: number | null = null;
  public editClientName: string = '';

  // --- Add Modal State ---
  public isAddModalVisible = false;
  public isModalClosing = false;
  public newClient: ClientForm = { clientName: '' };

  constructor(
    private clientService: ClientService,
    private toastService: ToastService
  ) { }

  public ngOnInit(): void {
    this.fetchClients();
  }

  ngAfterViewInit(): void {
    // Set up border glow effect for tables and search inputs
    this.setupGlowEffect();
  }

  private setupGlowEffect(): void {
    const setupElements = () => {
      // Get all table cards, controls cards, and search inputs
      const tableCards = document.querySelectorAll('.table-card');
      const controlsCards = document.querySelectorAll('.controls-card');
      const searchInputs = document.querySelectorAll('.filter-input, .search-input');

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

  public fetchClients(): void {
    this.isLoading = true;
    this.showContent = false;

    // Clear clients array to show skeleton placeholder during pagination
    // Keep paginationData to prevent layout shift in pagination controls
    this.clients = [];

    const filterName = this.activeSearchTerm.trim() || null;

    this.clientService.getFilteredClients(filterName, this.currentPage, this.pageSize)
      .subscribe({
        next: (data) => {
          // Store the data temporarily
          const loadedData = data;
          
          // Start skeleton fade-out animation by setting isLoading to false
          this.isLoading = false;
          
          // Wait for skeleton fade-out animation to complete (0.2s) before showing content
          setTimeout(() => {
            this.clients = loadedData.content;
            this.paginationData = loadedData;
            // bounds-check for currentPage vs totalPages
            if (this.paginationData && this.paginationData.totalPages > 0 && this.currentPage >= this.paginationData.totalPages) {
              this.currentPage = Math.max(0, this.paginationData.totalPages - 1);
            }
            this.showContent = true;
            // Re-setup glow effect after content is shown
            setTimeout(() => this.setupGlowEffect(), 100);
          }, 200); // Match skeleton fade-out duration (0.2s)
        },
        error: (err) => {
          this.isLoading = false;
          setTimeout(() => {
            this.clients = [];
            // Only clear paginationData on error if we don't have valid data
            if (!this.paginationData || this.paginationData.totalElements === 0) {
              this.paginationData = null;
            }
            this.showContent = true; // Show empty state
            this.handleApiError(err, 'load');
          }, 200);
        }
      });
  }


  // --- Search/Filter Logic ---
  public applyFilter(): void {
    // 1. Set the active search term
    this.activeSearchTerm = this.searchTerm;
    // 2. Reset to page 0
    this.currentPage = 0;
    // 3. Fetch data from backend
    this.fetchClients();
  }

  public resetFilters(): void {
    this.searchTerm = '';
    this.activeSearchTerm = '';
    this.currentPage = 0;
    this.fetchClients();
  }

  // --- Pagination ---
  public goToPage(page: number): void {
    if (page < 0 || (this.paginationData && page >= this.paginationData.totalPages)) {
      return;
    }
    this.currentPage = page;
    this.fetchClients(); // Fetch data for the new page
  }


  // --- Inline Edit Logic ---
  public startEdit(client: Client): void {
    if (this.editingClientId !== null || this.isSaving) return;
    this.editingClientId = client.id;
    this.editClientName = client.clientName;
  }

  public cancelEdit(): void {
    this.editingClientId = null;
    this.editClientName = '';
  }

  public saveEdit(originalClient: Client): void {
    if (this.editingClientId !== originalClient.id || this.isSaving) return;

    const newName = this.editClientName.trim();
    if (!newName) {
      this.toastService.showError("Client name cannot be empty.");
      return;
    }
    if (newName === originalClient.clientName) {
      this.cancelEdit();
      return;
    }

    this.isSaving = true;
    const form: ClientForm = { clientName: newName };

    this.clientService.updateClient(originalClient.id, form)
      .pipe(finalize(() => {
        this.isSaving = false;
        this.cancelEdit();
      }))
      .subscribe({
        next: (updatedClient) => {
          this.toastService.showSuccess("Client updated successfully!");
          // --- FIX: Refresh the current page of data ---
          this.fetchClients();
        },
        error: (err) => {
          this.handleApiError(err, 'update');
        }
      });
  }

  // --- Add Modal ---
  public openAddModal(): void {
    this.cancelEdit();
    document.body.style.overflow = 'hidden';
    this.newClient = { clientName: '' };
    this.isAddModalVisible = true;
    this.isModalClosing = false;
  }

  public closeAddModal(): void {
    if (this.isModalClosing || this.isSaving) return;
    this.isModalClosing = true;
    setTimeout(() => {
      // Remove inline style instead of setting to 'auto' to avoid conflicts with CSS
      document.body.style.overflow = '';
      this.isAddModalVisible = false;
      this.isModalClosing = false;
    }, 300);
  }

  public closeModalOnBackdropClick(event: MouseEvent, modalType: 'add'): void {
    if (this.isSaving) return;
    if (event.target === event.currentTarget) {
      this.closeAddModal();
    }
  }

  // --- Data Logic ---
  public addClient(): void {
    if (!this.newClient.clientName || !this.newClient.clientName.trim() || this.isSaving) {
      if (!this.isSaving && (!this.newClient.clientName || !this.newClient.clientName.trim())) {
        this.toastService.showError("Client name cannot be empty.");
      }
      return;
    }
    this.isSaving = true;
    const clientToAdd: ClientForm = { clientName: this.newClient.clientName.trim() };
    let addedSuccessfully = false;

    this.clientService.createClient(clientToAdd)
      .pipe(finalize(() => {
        this.isSaving = false
        if (addedSuccessfully) this.closeAddModal();
      }))
      .subscribe({
        next: (addedClient) => {
          addedSuccessfully = true;
          this.toastService.showSuccess('Client added successfully!');

          this.resetFilters();

        },
        error: (err) => {
          this.handleApiError(err, 'add');
        }
      });
  }

  // --- Error Handling ---
  private handleApiError(err: any, context: 'add' | 'update' | 'load'): void {
    let action: string;
    if (context === 'load') {
      action = 'load clients';
    } else {
      action = context === 'add' ? 'add client' : 'update client';
    }
    const defaultMessage = `Unable to ${action}. Please try again.`;
    handleHttpError(err, this.toastService, defaultMessage);
  }

  // --- TrackBy ---
  public trackClientById(index: number, client: Client): number {
    return client.id;
  }
}

