import { Injectable } from '@angular/core';
import { HttpClient,HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Client, ClientForm } from '../models/client.model'; // Import the interface you just created
import { PaginationData } from '../models/pagination.model';
@Injectable({
  providedIn: 'root'
})
export class ClientService {
  // The URL of your backend API endpoint
  private apiUrl = 'http://localhost:8080/pos/clients';

  // This injects Angular's HttpClient, allowing us to make API calls
  constructor(private http: HttpClient) { }

  getFilteredClients(clientName: string | null, page: number, size: number): Observable<PaginationData<Client>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (clientName) {
      params = params.append('clientName', clientName);
    }

    return this.http.get<PaginationData<Client>>(this.apiUrl, { params });
  }

  createClient(form: ClientForm): Observable<Client> {
    return this.http.post<Client>(this.apiUrl, form);
  }

  updateClient(id: number, form: ClientForm): Observable<Client> {
    return this.http.put<Client>(`${this.apiUrl}/${id}`, form);
  }
}