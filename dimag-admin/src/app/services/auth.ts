import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const API_URL = 'https://dimag-app-production.up.railway.app/api';
const SESSION_KEY = 'guiio-admin-session';
const VENDORS_KEY  = 'guiio-admin-vendors';

export type UserRole = 'admin' | 'vendedor';

export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
}

interface SessionData {
  token: string | null;
  role: UserRole;
  username: string;
}

interface VendorEntry { id: string; username: string; password: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly _session = signal<SessionData | null>(this.loadSession());

  readonly currentUser = computed<AppUser | null>(() => {
    const s = this._session();
    return s ? { id: s.username, username: s.username, role: s.role } : null;
  });

  readonly isLoggedIn = computed(() => this._session() !== null);
  readonly isAdmin   = computed(() => this._session()?.role === 'admin');

  getToken(): string | null {
    return this._session()?.token ?? null;
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ token: string; role: string; username: string }>(
          `${API_URL}/auth/login`,
          { username, password },
        ),
      );
      const session: SessionData = { token: res.token, role: res.role as UserRole, username: res.username };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      this._session.set(session);
      return true;
    } catch { /* fall through to local vendor check */ }

    // Local vendor fallback
    const vendor = this.getLocalVendors().find(v => v.username === username && v.password === password);
    if (vendor) {
      const session: SessionData = { token: null, role: 'vendedor', username: vendor.username };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      this._session.set(session);
      return true;
    }

    return false;
  }

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    this._session.set(null);
  }

  getVendedores(): AppUser[] {
    return this.getLocalVendors().map(v => ({ id: v.id, username: v.username, role: 'vendedor' as UserRole }));
  }

  createVendedor(username: string, password: string): { ok: boolean; error?: string } {
    const vendors = this.getLocalVendors();
    if (vendors.some(v => v.username === username)) return { ok: false, error: 'El usuario ya existe' };
    const updated = [...vendors, { id: Date.now().toString(), username, password }];
    localStorage.setItem(VENDORS_KEY, JSON.stringify(updated));
    return { ok: true };
  }

  deleteVendedor(id: string) {
    const updated = this.getLocalVendors().filter(v => v.id !== id);
    localStorage.setItem(VENDORS_KEY, JSON.stringify(updated));
  }

  changePassword(id: string, newPassword: string) {
    const updated = this.getLocalVendors().map(v => v.id === id ? { ...v, password: newPassword } : v);
    localStorage.setItem(VENDORS_KEY, JSON.stringify(updated));
  }

  private getLocalVendors(): VendorEntry[] {
    try {
      const raw = localStorage.getItem(VENDORS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private loadSession(): SessionData | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.role && parsed?.username) return parsed as SessionData;
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}

