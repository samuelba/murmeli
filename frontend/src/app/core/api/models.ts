import { Avatar } from '../avatars/avatar-catalog';
import { Language } from '../i18n/languages';

export type Role = 'parent' | 'admin';
export const ROLES: readonly Role[] = ['parent', 'admin'];
export type ThemePreference = 'light' | 'dark' | 'system';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly locale: Language;
  readonly emailVerified: boolean;
  readonly totpEnabled: boolean;
  readonly createdAt: string;
  readonly theme?: ThemePreference | null;
}

export interface AuthConfig {
  readonly registrationEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly setupRequired: boolean;
  /** The server has SETUP_TOKEN set: the setup form must send it. */
  readonly setupTokenRequired?: boolean;
}

export interface MeResponse {
  readonly user: User;
  readonly parentGateExpiresAt: string | null;
  readonly activeKid: Kid | null;
}

export type LoginResponse = { readonly user: User } | { readonly totpRequired: true };

export type TotpVerification = { readonly code: string } | { readonly recoveryCode: string };

export type StartClass = 'KG1' | 'KG2' | '1' | '2';
export const START_CLASSES: readonly StartClass[] = ['KG1', 'KG2', '1', '2'];
export type ReadAloud = 'auto' | 'on' | 'off';
export const READ_ALOUD_MODES: readonly ReadAloud[] = ['auto', 'on', 'off'];

/** Indexes 0–8 into the 3×3 picture grid; exactly four of them, order counts. */
export type PicturePin = readonly number[];

export interface Kid {
  readonly id: string;
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly startClass: StartClass;
  readonly birthYear: number | null;
  readonly language: Language;
  readonly hasPin: boolean;
  readonly dailyLimitMinutes: number | null;
  readonly soundEnabled: boolean;
  readonly readAloud: ReadAloud;
}

export interface KidInput {
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly startClass: StartClass;
  readonly birthYear?: number | null;
  readonly language: Language;
  readonly pin?: PicturePin | null;
  readonly dailyLimitMinutes?: number | null;
  readonly soundEnabled?: boolean;
  readonly readAloud?: ReadAloud;
}

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface AdminUser extends User {
  readonly disabled: boolean;
  readonly kidCount: number;
  readonly lastLoginAt: string | null;
}

export interface Invite {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly createdBy: string | null;
}

export type EmailStatus = 'sent' | 'queued' | 'disabled';

export interface CreatedInvite {
  readonly invite: Invite;
  readonly inviteUrl: string;
  readonly emailStatus: EmailStatus;
}

export interface InviteDetails {
  readonly email: string;
  readonly role: Role;
  readonly expiresAt: string;
}

export interface AdminSettings {
  readonly registrationEnabled: boolean;
  readonly requireAdminTotp: boolean;
  readonly emailEnabled: boolean;
}

export interface AuditEntry {
  readonly id: string;
  readonly at: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly ip: string | null;
  readonly meta: Readonly<Record<string, unknown>> | null;
}

export const AUDIT_ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.session_compromised',
  'auth.password_reset',
  'auth.password_changed',
  'auth.email_changed',
  'auth.totp_enabled',
  'auth.totp_disabled',
  'account.deleted',
  'admin.user_updated',
  'admin.user_deleted',
  'admin.invite_created',
  'admin.invite_revoked',
  'admin.settings_updated',
  'kid.created',
  'kid.deleted',
  'kid.pin_locked',
] as const;

export interface AdminStats {
  readonly users: number;
  readonly kids: number;
  readonly activeKidsLast7Days: number;
}

export interface TotpSetup {
  readonly otpauthUrl: string;
  readonly qrDataUrl: string;
}

export interface RecoveryCodes {
  readonly recoveryCodes: readonly string[];
}
