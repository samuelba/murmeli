import { Routes } from '@angular/router';

export const LEARN_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'learn.pageTitle',
    loadComponent: () => import('./map/trail-map').then((m) => m.TrailMap),
  },
  {
    path: 'level/:levelId',
    title: 'learn.levelTitle',
    loadComponent: () => import('./player/player').then((m) => m.Player),
  },
  {
    path: 'practice',
    pathMatch: 'full',
    title: 'learn.practiceTitle',
    loadComponent: () => import('./practice/practice-ground').then((m) => m.PracticeGround),
  },
  {
    path: 'practice/mix',
    title: 'learn.practiceTitle',
    loadComponent: () => import('./player/player').then((m) => m.Player),
  },
  {
    path: 'practice/:topicId',
    title: 'learn.practiceTitle',
    loadComponent: () => import('./player/player').then((m) => m.Player),
  },
];
