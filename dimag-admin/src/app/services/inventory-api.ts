import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Sede } from './sedes-api';

const API_URL = 'https://dimag-app-production.up.railway.app/api';

export interface InventoryItem {
  id: string; sedeId: string; productId: string; size: string;
  quantity: number; productName: string; sede: Sede; updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);

  getAll() { return this.http.get<InventoryItem[]>(`${API_URL}/inventory`); }

  upsert(sedeId: string, productId: string, size: string, quantity: number) {
    return this.http.put<InventoryItem>(`${API_URL}/inventory`, { sedeId, productId, size, quantity });
  }
}

