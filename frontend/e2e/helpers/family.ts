import { routeAudio } from './audio';
import { LearnBackend, type LearnOptions } from './learn-fixtures';
import {
  MockBackend,
  type MockRequest,
  type RouteTarget,
  altchaChallenge,
  apiError,
} from './mock-api';
import { progressFixture } from './progress-fixtures';
import type { ParentProgressResponse } from '../../src/app/pages/parent/progress/parent-progress.types';

export const PASSWORD = 'correct horse battery';
export const TOTP_CODE = '123456';
export const RECOVERY_CODE = 'abcd-efgh-ijkl';

export interface Avatar {
  animal: string;
  accessory: string | null;
  background: string;
}

export interface Kid {
  id: string;
  nickname: string;
  avatar: Avatar;
  startClass: 'KG1' | 'KG2' | '1' | '2';
  birthYear: number | null;
  language: 'de-CH' | 'en-US';
  hasPin: boolean;
  dailyLimitMinutes: number | null;
  soundEnabled: boolean;
  readAloud: 'auto' | 'on' | 'off';
}

export interface User {
  id: string;
  email: string;
  role: 'parent' | 'admin';
  locale: 'de-CH' | 'en-US';
  emailVerified: boolean;
  totpEnabled: boolean;
  createdAt: string;
}

export function user(overrides: Partial<User> = {}): User {
  return {
    id: '0190a000-0000-7000-8000-000000000001',
    email: 'eltern@example.ch',
    role: 'parent',
    locale: 'de-CH',
    emailVerified: true,
    totpEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function kid(overrides: Partial<Kid> = {}): Kid {
  return {
    id: '0190a000-0000-7000-8000-0000000000a1',
    nickname: 'Mia',
    avatar: { animal: 'fox', accessory: 'crown', background: '#FFD8A8' },
    startClass: 'KG2',
    birthYear: null,
    language: 'de-CH',
    hasPin: false,
    dailyLimitMinutes: null,
    soundEnabled: true,
    readAloud: 'auto',
    ...overrides,
  };
}

export interface FamilyOptions {
  loggedIn?: boolean;
  gate?: boolean;
  user?: User;
  kids?: Kid[];
  totp?: boolean;
  registrationEnabled?: boolean;
  setupRequired?: boolean;
  /** The correct picture PIN per kid id. */
  pins?: Record<string, number[]>;
  /** Kid ids whose PIN is locked out (429). */
  lockedKids?: string[];
  /** The learning API fake (map, runs, answers). */
  learn?: LearnOptions;
  /** Serve the e2e narration fixtures under /audio (default true). */
  audio?: boolean;
  /** `legal` of `GET /api/auth/config` (operator info). */
  legal?: {
    operatorName: string | null;
    contactEmail: string | null;
    address: string | null;
    privacyNote: string | null;
  } | null;
  /** `GET /api/parent/kids/:id/progress` (default: progressFixture). */
  progress?: (kidId: string) => ParentProgressResponse;
}

export interface FamilyState {
  loggedIn: boolean;
  gateExpiresAt: string | null;
  user: User;
  kids: Kid[];
  activeKid: Kid | null;
  registrationEnabled: boolean;
  requireAdminTotp: boolean;
  setupRequired: boolean;
}

const gateTime = () => new Date(Date.now() + 10 * 60_000).toISOString();

/** A stateful fake of the accounts API (docs/internal/api-accounts.md). */
export class FamilyBackend extends MockBackend {
  readonly state: FamilyState;
  readonly learn: LearnBackend;
  /** Narration files the audio element played, in order (prefetches not counted). */
  audioRequests: string[] = [];

  constructor(private readonly options: FamilyOptions = {}) {
    super();
    this.state = {
      loggedIn: options.loggedIn ?? true,
      gateExpiresAt: options.gate ? gateTime() : null,
      user: options.user ?? user({ totpEnabled: options.totp ?? false }),
      kids: options.kids ?? [],
      activeKid: null,
      registrationEnabled: options.registrationEnabled ?? true,
      requireAdminTotp: false,
      setupRequired: options.setupRequired ?? false,
    };
    this.registerAuth();
    this.registerKids();
    this.registerAdmin();
    this.learn = new LearnBackend(options.learn).install(this);
  }

  override async install(page: RouteTarget): Promise<this> {
    await super.install(page);
    if (this.options.audio !== false) {
      this.audioRequests = await routeAudio(page);
    }
    return this;
  }

  private me() {
    const { loggedIn, user: account, gateExpiresAt, activeKid } = this.state;
    return loggedIn
      ? { body: { user: account, parentGateExpiresAt: gateExpiresAt, activeKid } }
      : apiError(401, 'UNAUTHORIZED');
  }

  private signIn() {
    this.state.loggedIn = true;
    this.state.gateExpiresAt = gateTime();
    return { body: { user: this.state.user } };
  }

  private registerAuth(): void {
    const body = (request: MockRequest) => (request.body ?? {}) as Record<string, unknown>;
    this.onAll({
      'GET /api/auth/config': () => ({
        body: {
          registrationEnabled: this.state.registrationEnabled,
          emailEnabled: true,
          setupRequired: this.state.setupRequired,
          legal: this.options.legal ?? null,
        },
      }),
      'GET /api/auth/me': () => this.me(),
      'GET /api/auth/altcha': () => altchaChallenge(),
      'POST /api/auth/refresh': () =>
        this.state.loggedIn ? { body: { ok: true } } : apiError(401, 'SESSION_EXPIRED'),
      'POST /api/auth/login': (request) => {
        if (body(request)['password'] !== PASSWORD) {
          return apiError(401, 'INVALID_CREDENTIALS');
        }
        return this.state.user.totpEnabled ? { body: { totpRequired: true } } : this.signIn();
      },
      'POST /api/auth/totp/verify': (request) => {
        const { code, recoveryCode } = body(request);
        return code === TOTP_CODE || recoveryCode === RECOVERY_CODE
          ? this.signIn()
          : apiError(401, 'TOTP_INVALID');
      },
      'POST /api/auth/setup': (request) => {
        this.state.setupRequired = false;
        this.state.user = user({ role: 'admin', email: String(body(request)['email']) });
        return { status: 201, ...this.signIn() };
      },
      'POST /api/auth/register': { status: 202, body: { ok: true } },
      'POST /api/auth/logout': () => {
        this.state.loggedIn = false;
        this.state.gateExpiresAt = null;
        this.state.activeKid = null;
        return { status: 204 };
      },
      'POST /api/auth/parent-gate': (request) => {
        if (body(request)['password'] !== PASSWORD) {
          return apiError(401, 'INVALID_CREDENTIALS');
        }
        this.state.gateExpiresAt = gateTime();
        return { body: { parentGateExpiresAt: this.state.gateExpiresAt } };
      },
      'POST /api/auth/parent-gate/lock': () => {
        this.state.gateExpiresAt = null;
        return { status: 204 };
      },
    });
  }

  private registerKids(): void {
    this.onAll({
      'GET /api/kids': () => ({ body: this.state.kids }),
      'POST /api/kids': (request) => {
        const input = request.body as Partial<Kid> & { pin?: number[] };
        const created = kid({
          ...input,
          id: `0190a000-0000-7000-8000-0000000000b${this.state.kids.length}`,
          hasPin: Array.isArray(input.pin),
        });
        delete (created as Partial<Kid> & { pin?: unknown }).pin;
        this.state.kids.push(created);
        return { status: 201, body: created };
      },
      'POST /api/kids/deactivate': () => {
        this.state.activeKid = null;
        return { status: 204 };
      },
      'POST /api/kids/:id/activate': (request) => {
        const found = this.state.kids.find((item) => item.id === request.params['id']);
        if (!found) {
          return apiError(404, 'KID_NOT_FOUND');
        }
        if (this.options.lockedKids?.includes(found.id)) {
          return apiError(429, 'PIN_LOCKED', { 'Retry-After': '600' });
        }
        const expected = this.options.pins?.[found.id];
        const pin = (request.body as { pin?: number[] } | undefined)?.pin;
        if (expected && pin?.join() !== expected.join()) {
          return apiError(401, 'PIN_INVALID');
        }
        this.state.activeKid = found;
        this.state.gateExpiresAt = null;
        return { body: found };
      },
      'GET /api/parent/kids/:id/progress': (request) => {
        const found = this.state.kids.find((item) => item.id === request.params['id']);
        if (!found) {
          return apiError(404, 'KID_NOT_FOUND');
        }
        return { body: (this.options.progress ?? progressFixture)(found.id) };
      },
    });
  }

  private registerAdmin(): void {
    const page = <T>(items: T[]) => ({
      body: { items, total: items.length, page: 1, pageSize: 20 },
    });
    this.onAll({
      'GET /api/admin/stats': { body: { users: 3, kids: 5, activeKidsLast7Days: 2 } },
      'GET /api/admin/users': () =>
        page([
          {
            ...this.state.user,
            disabled: false,
            kidCount: this.state.kids.length,
            lastLoginAt: null,
          },
          {
            ...user({ id: '0190a000-0000-7000-8000-000000000002', email: 'gast@example.ch' }),
            emailVerified: false,
            disabled: false,
            kidCount: 0,
            lastLoginAt: '2026-11-01T08:00:00.000Z',
          },
        ]),
      'POST /api/admin/users/:id/password-reset-link': () => ({
        status: 201,
        body: {
          resetUrl: 'http://localhost/reset-password?token=reset123token',
          expiresAt: '2026-11-27T10:00:00.000Z',
        },
      }),
      'POST /api/admin/users/:id/verify-email': (request) => ({
        body: {
          ...user({ id: request.params['id'], email: 'gast@example.ch' }),
          emailVerified: true,
          disabled: false,
          kidCount: 0,
          lastLoginAt: '2026-11-01T08:00:00.000Z',
        },
      }),
      'GET /api/admin/invites': () => page([]),
      'POST /api/admin/invites': (request) => {
        const { email, role } = request.body as { email: string; role: string };
        return {
          status: 201,
          body: {
            invite: {
              id: '0190a000-0000-7000-8000-0000000000c1',
              email,
              role,
              expiresAt: '2026-12-31T00:00:00.000Z',
              createdAt: '2026-11-26T00:00:00.000Z',
              createdBy: this.state.user.id,
            },
            inviteUrl: 'http://localhost/invite/abc123token',
            emailStatus: 'disabled',
          },
        };
      },
      'GET /api/admin/settings': () => ({
        body: {
          registrationEnabled: this.state.registrationEnabled,
          requireAdminTotp: this.state.requireAdminTotp,
          emailEnabled: false,
        },
      }),
      'PATCH /api/admin/settings': (request) => {
        Object.assign(this.state, request.body as object);
        return { body: {} };
      },
      'GET /api/admin/audit-log': () =>
        page([
          {
            id: '0190a000-0000-7000-8000-0000000000d1',
            at: '2026-11-26T08:00:00.000Z',
            actorId: this.state.user.id,
            action: 'auth.login',
            targetType: 'user',
            targetId: this.state.user.id,
            ip: '203.0.113.0',
            meta: null,
          },
        ]),
    });
  }
}

export async function mockFamily(
  page: RouteTarget,
  options: FamilyOptions = {},
): Promise<FamilyBackend> {
  return new FamilyBackend(options).install(page);
}
