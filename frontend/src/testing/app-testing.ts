import { EnvironmentProviders, Provider, Type } from '@angular/core';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { Kid, User } from '../app/core/api/models';
import { provideAppHttp } from '../app/core/http/provide-http';
import { registerAppLocales } from '../app/core/i18n/languages';
import { provideTranslocoTesting } from './i18n';

export function provideAppTesting(routes: Routes = []): (Provider | EnvironmentProviders)[] {
  registerAppLocales();
  return [
    provideRouter(routes),
    provideAppHttp(),
    provideHttpClientTesting(),
    provideTranslocoTesting(),
  ];
}

export async function renderComponent<T>(
  component: Type<T>,
  inputs: Record<string, unknown> = {},
): Promise<{ fixture: ComponentFixture<T>; element: HTMLElement }> {
  const fixture = TestBed.createComponent(component);
  Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

export function byTestId<T extends HTMLElement = HTMLElement>(root: ParentNode, id: string): T {
  const found = root.querySelector<T>(`[data-testid="${id}"]`);
  if (!found) {
    throw new Error(`Missing [data-testid="${id}"]`);
  }
  return found;
}

export function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

export function submit(root: ParentNode, selector = 'form'): void {
  const form = root.querySelector<HTMLFormElement>(selector);
  if (!form) {
    throw new Error(`Missing ${selector}`);
  }
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}

export const USER: User = {
  id: 'u1',
  email: 'parent@example.com',
  role: 'parent',
  locale: 'de-CH',
  emailVerified: true,
  totpEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const ADMIN: User = { ...USER, id: 'a1', email: 'admin@example.com', role: 'admin' };

export const KID: Kid = {
  id: 'k1',
  nickname: 'Mia',
  avatar: { animal: 'fox', accessory: 'crown', background: '#FFD8A8' },
  startClass: 'KG2',
  birthYear: null,
  language: 'de-CH',
  hasPin: true,
  dailyLimitMinutes: 30,
  soundEnabled: true,
  readAloud: 'auto',
};

export function errorBody(errorCode: string, statusCode: number) {
  return { statusCode, errorCode, message: errorCode };
}

export async function settle(fixture?: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture?.whenStable();
  }
}
