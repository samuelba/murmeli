import type { Locale } from '../users/user.types';

export const START_CLASSES = ['KG1', 'KG2', '1', '2'] as const;
export type StartClass = (typeof START_CLASSES)[number];

export const READ_ALOUD_MODES = ['auto', 'on', 'off'] as const;
export type ReadAloud = (typeof READ_ALOUD_MODES)[number];

export const MAX_KIDS_PER_USER = 8;
export const NICKNAME_MAX_LENGTH = 20;
export const NICKNAME_PATTERN = /^[\p{L}\p{M}\p{N} -]{1,20}$/u;
export const PIN_LENGTH = 4;
export const PIN_MAX_INDEX = 8;
export const DAILY_LIMIT_MIN = 5;
export const DAILY_LIMIT_MAX = 240;
export const BIRTH_YEAR_MIN = 2000;
export const BIRTH_YEAR_MAX = 2100;

export interface Avatar {
  readonly animal: string;
  readonly accessory: string | null;
  readonly background: string;
}

export interface KidView {
  readonly id: string;
  readonly nickname: string;
  readonly avatar: Avatar;
  readonly startClass: StartClass;
  readonly birthYear: number | null;
  readonly language: Locale;
  readonly hasPin: boolean;
  readonly dailyLimitMinutes: number | null;
  readonly soundEnabled: boolean;
  readonly readAloud: ReadAloud;
}
