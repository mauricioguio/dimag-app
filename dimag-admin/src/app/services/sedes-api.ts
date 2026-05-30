import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://dimag-app-production.up.railway.app/api';

export interface Sede {
  id: string; name: string; pin: string | null;
  active: boolean; createdAt: string; updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SedesApiService {
  private readonly http = inject(HttpClient);

  getAll() { return this.http.get<Sede[]>(`${API_URL}/sedes`); }
  create(name: string) { return this.http.post<Sede>(`${API_URL}/sedes`, { name }); }
  update(id: string, data: { name?: string; active?: boolean; pin?: string | null }) { return this.http.patch<Sede>(`${API_URL}/sedes/${id}`, data); }
  remove(id: string) { return this.http.delete<{ deleted: boolean }>(`${API_URL}/sedes/${id}`); }
}

