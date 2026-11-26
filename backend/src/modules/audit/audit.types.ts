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
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = ['user', 'kid', 'invite', 'setting'] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export type AuditMeta = Readonly<Record<string, string | number | boolean>>;

export interface AuditEvent {
  readonly action: AuditAction;
  readonly actorId?: string | null;
  readonly targetType?: AuditTargetType;
  readonly targetId?: string;
  readonly ip?: string | null;
  readonly meta?: AuditMeta;
}

export const AUDIT_RETENTION_DAYS = 180;
