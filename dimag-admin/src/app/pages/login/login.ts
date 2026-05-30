import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly error = signal(false);
  protected readonly loading = signal(false);
  protected showPassword = false;

  protected readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  async submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(false);

    const { username, password } = this.form.value;
    const ok = await this.auth.login(username!, password!);

    if (ok) {
      this.router.navigate(['/dashboard']);
    } else {
      this.error.set(true);
      this.loading.set(false);
    }
  }
}
