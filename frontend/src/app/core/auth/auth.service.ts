import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AuthConfig,
  InviteDetails,
  Kid,
  LoginResponse,
  MeResponse,
  TotpVerification,
  User,
} from '../api/models';
import { isApiError } from '../http/api-error';
import { ApiService } from '../http/api.service';
import { quietSession } from '../http/http-context';
import { LanguageService } from '../i18n/language.service';
import { Language } from '../i18n/languages';

export type LoginOutcome = 'signed-in' | 'totp-required';

export interface NewAccount {
  readonly email: string;
  readonly password: string;
  readonly locale: Language;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly language = inject(LanguageService);

  private readonly userState = signal<User | null>(null);
  private readonly kidState = signal<Kid | null>(null);
  private readonly gateState = signal<number | null>(null);
  private readonly configState = signal<AuthConfig | null>(null);
  private readonly now = signal(Date.now());
  private gateTimer: ReturnType<typeof setTimeout> | undefined;

  readonly user = this.userState.asReadonly();
  readonly activeKid = this.kidState.asReadonly();
  readonly parentGateExpiresAt = this.gateState.asReadonly();
  readonly config = this.configState.asReadonly();
  readonly isLoggedIn = computed(() => this.userState() !== null);
  readonly isAdmin = computed(() => this.userState()?.role === 'admin');
  readonly hasParentGate = computed(() => {
    const expiresAt = this.gateState();
    return expiresAt !== null && expiresAt > this.now();
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.gateTimer));
  }

  async init(): Promise<void> {
    await Promise.all([this.loadConfig().catch(() => null), this.refreshSession()]);
  }

  async loadConfig(force = false): Promise<AuthConfig> {
    const cached = this.configState();
    if (cached && !force) {
      return cached;
    }
    const config = await firstValueFrom(this.api.get<AuthConfig>('auth/config'));
    this.configState.set(config);
    return config;
  }

  /**
   * Reloads /auth/me. A lost session is cleared by the auth interceptor (refresh answered 401);
   * transient failures (429, 5xx, offline) keep the current state.
   */
  async refreshSession(): Promise<boolean> {
    try {
      const me = await firstValueFrom(
        this.api.get<MeResponse>('auth/me', undefined, { context: quietSession() }),
      );
      this.applySession(me);
      return true;
    } catch {
      return false;
    }
  }

  hasParentGateNow(): boolean {
    this.now.set(Date.now());
    return this.hasParentGate();
  }

  async login(email: string, password: string): Promise<LoginOutcome> {
    const response = await firstValueFrom(
      this.api.post<LoginResponse>('auth/login', { email, password }),
    );
    if ('totpRequired' in response) {
      return 'totp-required';
    }
    await this.completeSignIn(response.user);
    return 'signed-in';
  }

  async verifyTotp(verification: TotpVerification): Promise<void> {
    const { user } = await firstValueFrom(
      this.api.post<{ user: User }>('auth/totp/verify', verification),
    );
    await this.completeSignIn(user);
  }

  async setup(account: NewAccount): Promise<void> {
    const { user } = await firstValueFrom(this.api.post<{ user: User }>('auth/setup', account));
    this.configState.update((config) => (config ? { ...config, setupRequired: false } : config));
    await this.completeSignIn(user);
  }

  inviteDetails(token: string): Promise<InviteDetails> {
    return firstValueFrom(this.api.get<InviteDetails>(`invites/${encodeURIComponent(token)}`));
  }

  async acceptInvite(token: string, password: string, locale: Language): Promise<void> {
    const { user } = await firstValueFrom(
      this.api.post<{ user: User }>(`invites/${encodeURIComponent(token)}/accept`, {
        password,
        locale,
        acceptTerms: true,
      }),
    );
    await this.completeSignIn(user);
  }

  /** Tries twice; the local session is only cleared once the server confirmed the logout. */
  async logout(): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await firstValueFrom(this.api.post<void>('auth/logout', {}, { context: quietSession() }));
        this.clear();
        return;
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          this.clear();
          return;
        }
        lastError = error;
      }
    }
    throw lastError;
  }

  async unlockParentGate(password: string): Promise<void> {
    const { parentGateExpiresAt } = await firstValueFrom(
      this.api.post<{ parentGateExpiresAt: string }>('auth/parent-gate', { password }),
    );
    this.setParentGate(parentGateExpiresAt);
  }

  async lockParentGate(): Promise<void> {
    await firstValueFrom(this.api.post<void>('auth/parent-gate/lock'));
    this.setParentGate(null);
  }

  setUser(user: User): void {
    this.userState.set(user);
  }

  setActiveKid(kid: Kid | null): void {
    this.kidState.set(kid);
    if (kid) {
      this.setParentGate(null);
    }
    this.applyLanguage();
  }

  markParentGateExpired(): void {
    this.setParentGate(null);
  }

  clear(): void {
    const hadSession = this.userState() !== null;
    this.userState.set(null);
    this.kidState.set(null);
    this.setParentGate(null);
    if (hadSession) {
      this.language.resetToPreference();
    }
  }

  private async completeSignIn(user: User): Promise<void> {
    this.userState.set(user);
    this.applyLanguage();
    await this.refreshSession();
  }

  private applySession(me: MeResponse): void {
    this.userState.set(me.user);
    this.kidState.set(me.activeKid);
    this.setParentGate(me.parentGateExpiresAt);
    this.applyLanguage();
  }

  private applyLanguage(): void {
    const language = this.kidState()?.language ?? this.userState()?.locale;
    if (language) {
      this.language.useLanguage(language);
    }
  }

  private setParentGate(expiresAt: string | null): void {
    clearTimeout(this.gateTimer);
    const time = expiresAt ? Date.parse(expiresAt) : NaN;
    this.gateState.set(Number.isNaN(time) ? null : time);
    this.now.set(Date.now());
    if (!Number.isNaN(time) && time > Date.now()) {
      this.gateTimer = setTimeout(() => this.now.set(Date.now()), time - Date.now() + 50);
    }
  }
}
