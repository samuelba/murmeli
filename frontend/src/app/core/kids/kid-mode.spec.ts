import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes } from '@angular/router';
import { KID, USER, provideAppTesting } from '../../../testing/app-testing';
import { AuthService } from '../auth/auth.service';
import { KidMode } from './kid-mode';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  { path: 'learn', component: Blank },
  { path: 'parent', component: Blank },
  { path: 'admin', component: Blank },
];

describe('KidMode', () => {
  let auth: AuthService;
  let router: Router;
  let kidMode: KidMode;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting(ROUTES) });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    kidMode = TestBed.inject(KidMode);
    auth.setUser(USER);
  });

  it('is off without an active kid', async () => {
    await router.navigateByUrl('/learn');
    expect(kidMode.active()).toBe(false);
    expect(kidMode.kid()).toBeNull();
  });

  it('is on with an active kid outside the grown-up pages', async () => {
    auth.setActiveKid(KID);
    await router.navigateByUrl('/learn');
    expect(kidMode.kid()).toEqual(KID);
    expect(kidMode.active()).toBe(true);
  });

  it('is off on parent and admin pages even with an active kid', async () => {
    auth.setActiveKid(KID);
    await router.navigateByUrl('/parent');
    expect(kidMode.active()).toBe(false);
    await router.navigateByUrl('/admin');
    expect(kidMode.active()).toBe(false);
    await router.navigateByUrl('/learn');
    expect(kidMode.active()).toBe(true);
  });
});

describe('KidMode before the first navigation', () => {
  it('reads the page URL, so a reload in the parent area is not kid mode', () => {
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(ROUTES), provideLocationMocks()],
    });
    TestBed.inject(Location).go('/parent/account');
    const auth = TestBed.inject(AuthService);
    auth.setUser(USER);
    auth.setActiveKid(KID);
    expect(TestBed.inject(KidMode).active()).toBe(false);
  });
});
