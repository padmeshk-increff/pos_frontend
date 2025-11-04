import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardSummary } from '../models/dashboard.model'; // 1. Import the new model

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = 'http://localhost:8080/pos/report'; // Base path for report controller

  constructor(private http: HttpClient) { }

  /**
   * Fetches the dashboard summary data from the backend.
   * @returns An Observable emitting the DashboardSummary data.
   */
  getSummaryData(): Observable<DashboardSummary> { // 2. Use the specific type
    // 3. Call the actual endpoint, remove mock data and delay
    return this.http.get<DashboardSummary>(`${this.apiUrl}/summary`);
  }

  /**
   * Fetches the Sales Report TSV file from the backend.
   */
  downloadSalesReport(startIso: string, endIso: string): Observable<Blob> {
    let params = new HttpParams()
      .set('start', startIso)
      .set('end', endIso);
    console.log("Requesting Sales Report with params:", params.toString());
    return this.http.get(`${this.apiUrl}/sales`, {
      params: params,
      responseType: 'blob'
    });
  }

  /**
   * Fetches the Inventory Report TSV file from the backend.
   */
  downloadInventoryReport(): Observable<Blob> {
    console.log("Requesting Inventory Report");
    return this.http.get(`${this.apiUrl}/inventory`, {
      responseType: 'blob'
    });
  }
}

