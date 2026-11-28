import { type Page, expect } from '@playwright/test';
import type { ExerciseTypeId } from '@murmeli/content';
import { type FamilyOptions, kid, mockFamily, user } from './family';

export const PIN_KID = kid({
  id: '0190a000-0000-7000-8000-0000000000a2',
  nickname: 'Leo',
  hasPin: true,
  avatar: { animal: 'owl', accessory: 'wizard-hat', background: '#C3F0C8' },
});

export interface Scenario {
  readonly name: string;
  readonly options: FamilyOptions;
  readonly open: (page: Page) => Promise<void>;
}

const signedOut: FamilyOptions = { loggedIn: false };
const family: FamilyOptions = { kids: [kid(), PIN_KID] };
const parent: FamilyOptions = { ...family, gate: true };
const admin: FamilyOptions = { ...parent, user: user({ role: 'admin' }) };

async function title(page: Page) {
  await expect(page.getByTestId('page-title').or(page.getByTestId('welcome-title'))).toBeVisible();
}

function visit(path: string, extra?: (page: Page) => Promise<void>) {
  return async (page: Page) => {
    await page.goto(path);
    await title(page);
    await extra?.(page);
  };
}

async function openLearn(page: Page) {
  await visit('/')(page);
  await page.getByTestId(`kid-tile-${kid().id}`).click();
  await page.getByTestId('trail').waitFor();
}

/** The milestone 5 exercise types, with a level for the modes the first level doesn't show. */
const EXERCISE_SCENARIOS: readonly (readonly [ExerciseTypeId, string?])[] = [
  ['times-table'],
  ['division-share'],
  ['clock'],
  ['money-chf'],
  ['money-chf', 'math-maertplatz-03'],
  ['money-chf', 'math-maertplatz-04'],
  ['trace-letter'],
  ['listen-write'],
  ['sentence-picture'],
];

/** The main pages, each with the backend state it needs. */
export const SCENARIOS: readonly Scenario[] = [
  { name: 'welcome', options: signedOut, open: visit('/') },
  { name: 'login', options: signedOut, open: visit('/login') },
  {
    name: 'register',
    options: signedOut,
    open: visit('/register', (page) => page.locator('altcha-widget').waitFor()),
  },
  { name: 'setup', options: { ...signedOut, setupRequired: true }, open: visit('/setup') },
  { name: 'forgot password', options: signedOut, open: visit('/forgot-password') },
  { name: 'privacy', options: signedOut, open: visit('/privacy') },
  {
    name: 'profile picker',
    options: family,
    open: visit('/', (page) => page.getByTestId(`kid-tile-${PIN_KID.id}`).waitFor()),
  },
  {
    name: 'PIN view',
    options: family,
    open: async (page) => {
      await visit('/')(page);
      await page.getByTestId(`kid-tile-${PIN_KID.id}`).click();
      await page.getByTestId('pin-view').waitFor();
    },
  },
  {
    name: 'learn',
    options: family,
    open: async (page) => {
      await visit('/')(page);
      await page.getByTestId(`kid-tile-${kid().id}`).click();
      await page.getByTestId('trail').waitFor();
    },
  },
  {
    name: 'practice ground',
    options: { ...family, learn: { progress: { 'math-zahlenwiese-01': 3 } } },
    open: async (page) => {
      await openLearn(page);
      await page.getByTestId('practice').click();
      await page.getByTestId('practice-topics').waitFor();
    },
  },
  {
    name: 'player',
    options: { ...family, learn: { demoSeen: ['math-zahlenwiese-01'] } },
    open: async (page) => {
      await openLearn(page);
      await page.goto('/learn/level/math-zahlenwiese-01');
      await page.getByTestId('prompt-text').waitFor();
    },
  },
  {
    name: 'demo',
    options: family,
    open: async (page) => {
      await openLearn(page);
      await page.goto('/learn/level/math-zahlenwiese-01');
      await page.getByTestId('demo').waitFor();
    },
  },
  ...EXERCISE_SCENARIOS.map(([type, level]): Scenario => ({
    name: `player ${type}${level ? ` ${level}` : ''}`,
    options: {
      ...family,
      learn: { exerciseType: type, items: 2, ...(level ? { exerciseLevel: level } : {}) },
    },
    open: async (page) => {
      await openLearn(page);
      await page.goto('/learn/level/math-zahlenwiese-01');
      await page.getByTestId('prompt-text').waitFor();
    },
  })),
  {
    name: 'demo trace-letter',
    options: { ...family, learn: { unlockAll: true } },
    open: async (page) => {
      await openLearn(page);
      await page.goto('/learn/level/reading-de-schreibwiese-01');
      await page.getByTestId('trace-surface').waitFor();
    },
  },
  {
    name: 'parent dashboard',
    options: parent,
    open: visit('/parent', (page) => page.getByTestId(`kid-row-${PIN_KID.id}`).waitFor()),
  },
  {
    name: 'kid form',
    options: parent,
    open: visit(`/parent/kids/${PIN_KID.id}`, (page) => page.getByTestId('kid-nickname').waitFor()),
  },
  {
    name: 'parent progress',
    options: parent,
    open: visit(`/parent/kids/${PIN_KID.id}/progress`, async (page) => {
      await page.getByTestId('progress-tracks').waitFor();
      await page.getByTestId('practice-mistakes').locator('summary').click();
    }),
  },
  {
    name: 'badge shelf',
    options: { ...family, learn: { progress: { 'math-zahlenwiese-01': 3 } } },
    open: async (page) => {
      await openLearn(page);
      await page.getByTestId('badges').click();
      await page.getByTestId('badge-shelf').waitFor();
    },
  },
  {
    name: 'offline',
    options: family,
    open: async (page) => {
      await openLearn(page);
      await page.context().setOffline(true);
      await page.getByTestId('offline-screen').waitFor();
    },
  },
  { name: 'account', options: parent, open: visit('/parent/account') },
  {
    name: 'admin users',
    options: admin,
    open: visit('/admin/users', (page) => page.getByTestId('users-table').waitFor()),
  },
  {
    name: 'admin invites',
    options: admin,
    open: visit('/admin/invites', (page) => page.getByTestId('invites-table').waitFor()),
  },
  {
    name: 'admin settings',
    options: admin,
    open: visit('/admin/settings', (page) =>
      page.getByTestId('setting-registrationEnabled').waitFor(),
    ),
  },
];

export async function openScenario(page: Page, scenario: Scenario) {
  const backend = await mockFamily(page, scenario.options);
  await scenario.open(page);
  return backend;
}
