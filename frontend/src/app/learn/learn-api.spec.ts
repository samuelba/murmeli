import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideAppTesting } from '../../testing/app-testing';
import { run } from '../../testing/learn-testing';
import {
  LearnContent,
  feedbackPhrases,
  hintText,
  pictureUrl,
  pictureWord,
} from './content/learn-content';
import { LearnApi } from './learn-api.service';
import { LanguageService } from '../core/i18n/language.service';

describe('LearnApi', () => {
  let http: HttpTestingController;
  let api: LearnApi;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(LearnApi);
  });

  afterEach(() => http.verify());

  it('talks to the learning endpoints', async () => {
    const map = api.map();
    http.expectOne({ method: 'GET', url: '/api/learn/map' }).flush({ tracks: [] });
    expect(await map).toEqual({ tracks: [] });

    const level = api.startLevel('math zahlenwiese/01');
    http
      .expectOne({ method: 'POST', url: '/api/learn/levels/math%20zahlenwiese%2F01/runs' })
      .flush(run());
    expect((await level).runId).toBe('r1');

    const practice = api.startPractice();
    http.expectOne({ method: 'POST', url: '/api/learn/practice/runs' }).flush(run());
    await practice;

    const answer = api.answer('r1', 2, { value: 3 });
    const request = http.expectOne({ method: 'POST', url: '/api/learn/runs/r1/answers' });
    expect(request.request.body).toEqual({ index: 2, answer: { value: 3 } });
    request.flush({ correct: true, attempt: 1 });
    expect(await answer).toEqual({ correct: true, attempt: 1 });

    const finish = api.finish('r1');
    http.expectOne({ method: 'POST', url: '/api/learn/runs/r1/finish' }).flush({ stars: 3 });
    expect(await finish).toEqual({ stars: 3 });
  });
});

describe('learn content', () => {
  it('has the words, hints and feedback phrases of the content package', () => {
    expect(pictureUrl('apple')).toBe('/pictures/apple.svg');
    expect(pictureUrl('shape-circle')).toBe('/pictures/shape-circle.svg');
    expect(pictureUrl('../x')).toBe('data:,');
    expect(pictureWord('apple', 'de-CH')).toBe('Apfel');
    expect(pictureWord('apple', 'en-US')).toBe('apple');
    expect(pictureWord('unknown', 'de-CH')).toBe('unknown');
    expect(hintText('make-ten', 'de-CH')).toBe('Mach zuerst die Zehn voll.');
    expect(hintText('nope', 'en-US')).toBeNull();
    expect(feedbackPhrases('correct', 'de-CH')).toContain('Super!');
  });

  it('follows the current language', () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const content = TestBed.inject(LearnContent);
    expect(content.word('mouse')).toBe('Maus');
    expect(content.hint(null)).toBeNull();
    expect(content.phrase('correct', () => 0)).toBe('Super!');
    TestBed.inject(LanguageService).useLanguage('en-US');
    expect(content.hint('make-ten')).toBe('Make ten first.');
    expect(content.phrase('try_again', () => 0.99)).toBe('Look again carefully.');
  });
});
