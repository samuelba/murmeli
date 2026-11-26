import type { KidEntity } from './kid.entity';
import type { KidView } from './kid.types';

export function toKidView(kid: KidEntity): KidView {
  return {
    id: kid.id,
    nickname: kid.nickname,
    avatar: {
      animal: kid.avatar.animal,
      accessory: kid.avatar.accessory ?? null,
      background: kid.avatar.background,
    },
    startClass: kid.startClass,
    birthYear: kid.birthYear,
    language: kid.language,
    hasPin: kid.pinHash !== null,
    dailyLimitMinutes: kid.dailyLimitMinutes,
    soundEnabled: kid.soundEnabled,
    readAloud: kid.readAloud,
  };
}
