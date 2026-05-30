import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from './products-api';

const API_URL = 'https://dimag-app-production.up.railway.app/api';

export interface Collection {
  id: string; name: string; description: string | null; image: string | null;
  featured: boolean; order: number; createdAt: string; updatedAt: string;
}

export type CollectionPayload = Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class CollectionsApiService {
  private readonly http = inject(HttpClient);

  getAll() { return this.http.get<Collection[]>(`${API_URL}/collections`); }
  create(data: CollectionPayload) { return this.http.post<Collection>(`${API_URL}/collections`, data); }
  update(id: string, data: CollectionPayload) { return this.http.patch<Collection>(`${API_URL}/collections/${id}`, data); }
  remove(id: string) { return this.http.delete(`${API_URL}/collections/${id}`); }
  getProducts(collectionId: string) { return this.http.get<Product[]>(`${API_URL}/collections/${collectionId}/products`); }
  addProduct(collectionId: string, productId: string) { return this.http.post<{ added: boolean }>(`${API_URL}/collections/${collectionId}/products`, { productId }); }
  removeProduct(collectionId: string, productId: string) { return this.http.delete<{ removed: boolean }>(`${API_URL}/collections/${collectionId}/products/${productId}`); }
}

