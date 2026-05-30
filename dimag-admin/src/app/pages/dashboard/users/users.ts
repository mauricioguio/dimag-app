import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, AppUser } from '../../../services/auth';

@Component({
  selector: 'app-users',
  imports: [FormsModule],
  templateUrl: './users.html',
})
export class Users {
  private readonly auth = inject(AuthService);

  protected vendedores = signal<AppUser[]>(this.auth.getVendedores());

  protected showForm = signal(false);
  protected username = '';
  protected password = '';
  protected errorMsg = signal('');
  protected showPassword = false;

  protected deletingId = signal<string | null>(null);

  create() {
    this.errorMsg.set('');
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMsg.set('Completa todos los campos');
      return;
    }
    if (this.password.length < 6) {
      this.errorMsg.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    const result = this.auth.createVendedor(this.username.trim(), this.password.trim());
    if (!result.ok) {
      this.errorMsg.set(result.error ?? 'Error al crear usuario');
      return;
    }
    this.username = '';
    this.password = '';
    this.showForm.set(false);
    this.refresh();
  }

  confirmDelete(id: string) {
    this.deletingId.set(id);
  }

  cancelDelete() {
    this.deletingId.set(null);
  }

  doDelete(id: string) {
    this.auth.deleteVendedor(id);
    this.deletingId.set(null);
    this.refresh();
  }

  private refresh() {
    this.vendedores.set(this.auth.getVendedores());
  }
}
