import type { UserEntity } from './user.entity';
import type { Locale, Role, Theme } from './user.types';

export interface UserView {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly locale: Locale;
  readonly theme: Theme | null;
  readonly emailVerified: boolean;
  readonly totpEnabled: boolean;
  readonly createdAt: string;
}

export function toUserView(user: UserEntity): UserView {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    locale: user.locale,
    theme: user.theme,
    emailVerified: user.emailVerifiedAt !== null,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}
