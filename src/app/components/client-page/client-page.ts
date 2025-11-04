import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { A11yModule } from '@angular/cdk/a11y';

import { trigger, transition, style, animate } from '@angular/animations';
import { ClientService } from '../../services/client';
import { Client, ClientForm } from '../../models/client.model';
import { ToastService } from '../../services/toast';
import { PaginationData } from '../../models/pagination.model'; // Import pagination model

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
        animate('0.6s ease-out',
          style({ opacity: 1, transform: 'translateY(0)' })
        )
      ])
    ]),
    trigger('fade', [
      // :enter (fade in)
      transition(':enter', [
        style({ opacity: 0 }),
        // Wait 300ms (for :leave) then fade in
        animate('0.5s 0.3s ease-out', style({ opacity: 1 }))
      ]),
      // :leave (fade out)
      transition(':leave', [
        // Fade out for 300ms
        animate('0.3s ease-in', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class ClientPageComponent implements OnInit {
  // --- STATE ---
  public clients: Client[] = []; // This list is now just for the current page
  public isLoading = true;
  public isSaving = false;
  public searchTerm: string = ''; // The value in the search box
  public activeSearchTerm: string = ''; // The filter currently applied

  // Add these new properties to the component class (near other state)
public showSkeleton = false;
public showLoaderOverlay = false;
private loaderOverlayTimer: any = null;
private pendingFetchedData: PaginationData<Client> | null = null;


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

  public fetchClients(): void {
  // Start sequence: show skeleton immediately; loader after a short delay
  this.isLoading = true;
  this.showSkeleton = true;
  this.showLoaderOverlay = false;

  // clear any previous timer
  if (this.loaderOverlayTimer) {
    clearTimeout(this.loaderOverlayTimer);
    this.loaderOverlayTimer = null;
  }

  // Only show the loader overlay if request takes longer than this (ms)
  const LOADER_DELAY_MS = 180;
  this.loaderOverlayTimer = setTimeout(() => {
    this.showLoaderOverlay = true;
    this.loaderOverlayTimer = null;
  }, LOADER_DELAY_MS);

  // Optionally clear table data on first page to avoid confusing tics
  if (this.currentPage === 0) {
    this.clients = [];
    this.paginationData = null;
  }

  const filterName = this.activeSearchTerm.trim() || null;

  // Keep incoming data in temp var so we can reveal it after skeleton fades
  this.pendingFetchedData = null;

  this.clientService.getFilteredClients(filterName, this.currentPage, this.pageSize)
    .subscribe({
      next: (data) => {
        // store incoming data; hide loader overlay immediately
        if (this.loaderOverlayTimer) {
          clearTimeout(this.loaderOverlayTimer);
          this.loaderOverlayTimer = null;
        }
        this.showLoaderOverlay = false;

        // mark loading finished (drives :leave animation)
        this.isLoading = false;

        // cache data until we remove skeleton (so content doesn't pop in under skeleton)
        this.pendingFetchedData = data;

        // after a short fade-out delay, apply the new content and hide skeleton
        const SKELETON_FADE_MS = 160;
        setTimeout(() => {
          if (this.pendingFetchedData) {
            this.clients = this.pendingFetchedData.content;
            this.paginationData = this.pendingFetchedData;
            // bounds-check for currentPage vs totalPages
            if (this.paginationData && this.paginationData.totalPages > 0 && this.currentPage >= this.paginationData.totalPages) {
              this.currentPage = Math.max(0, this.paginationData.totalPages - 1);
            }
            this.pendingFetchedData = null;
          }
          // hide skeleton to reveal content
          this.showSkeleton = false;
        }, SKELETON_FADE_MS);
      },
      error: (err) => {
        // cleanup timers & overlays
        if (this.loaderOverlayTimer) {
          clearTimeout(this.loaderOverlayTimer);
          this.loaderOverlayTimer = null;
        }
        this.showLoaderOverlay = false;
        this.isLoading = false;

        // hide skeleton after short delay so UI doesn't instantly jump
        setTimeout(() => {
          this.showSkeleton = false;
        }, 120);

        // clear data so empty state shows
        this.clients = [];
        this.paginationData = null;

        this.toastService.showError('Could not load clients.');
        console.error("Error loading clients:", err);
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
      document.body.style.overflow = 'auto';
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
        if(addedSuccessfully) this.closeAddModal();
      }))
      .subscribe({
        next: (addedClient) => {
          addedSuccessfully=true;
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
    let action: string = context;
    if (context !== 'load') {
      action = context === 'add' ? 'adding' : 'updating';
    }

    if (err.error?.message && typeof err.error.message === 'string') {
      this.toastService.showError(err.error.message);
    } else {
      this.toastService.showError(`Error ${action} client. Please try again.`);
      console.error(`Error ${action} client:`, err);
    }
  }

  // --- TrackBy ---
  public trackClientById(index: number, client: Client): number {
    return client.id;
  }
}

