import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { KID, USER, provideAppTesting, renderComponent } from '../../../testing/app-testing';
import { TopBar } from './top-bar';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  { path: 'learn', component: Blank },
  { path: 'parent', component: Blank },
];

describe('TopBar', () => {
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting(ROUTES) });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  const hasSwitch = (element: HTMLElement) =>
    element.querySelector('[data-testid="language-switch"]') !== null;

  it('shows the language switch to guests and parents', async () => {
    const guest = await renderComponent(TopBar);
    expect(hasSwitch(guest.element)).toBe(true);

    auth.setUser(USER);
    await guest.fixture.whenStable();
    expect(hasSwitch(guest.element)).toBe(true);
  });

  it('hides the language switch in kid mode and shows it again on parent pages', async () => {
    auth.setUser(USER);
    auth.setActiveKid(KID);
    await router.navigateByUrl('/learn');
    const { element, fixture } = await renderComponent(TopBar);
    expect(hasSwitch(element)).toBe(false);

    await router.navigateByUrl('/parent');
    await fixture.whenStable();
    expect(hasSwitch(element)).toBe(true);
  });
});
