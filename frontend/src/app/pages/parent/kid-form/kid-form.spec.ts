import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import {
  KID,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
  submit,
  type,
} from '../../../../testing/app-testing';
import { resetDocumentState } from '../../../../testing/browser';
import { KidForm } from './kid-form';

describe('KidForm', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  function setup(id: string | null) {
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }

  afterEach(() => {
    http.verify();
    resetDocumentState();
  });

  const tapPin = (element: HTMLElement, pin: number[]) =>
    pin.forEach((index) => byTestId(element, `pin-picture-${index}`).click());

  it('validates the nickname', async () => {
    setup(null);
    const { element, fixture } = await renderComponent(KidForm);
    type(byTestId<HTMLInputElement>(element, 'kid-nickname'), '<b>');
    submit(element);
    await fixture.whenStable();
    http.expectNone('/api/kids');
    expect(element.textContent).toContain('Nur Buchstaben');
  });

  it('creates a kid with avatar, settings and a confirmed picture PIN', async () => {
    setup(null);
    const { element, fixture } = await renderComponent(KidForm);
    byTestId<HTMLInputElement>(element, 'avatar-animal-owl').click();
    byTestId<HTMLInputElement>(element, 'avatar-accessory-bow').click();
    byTestId<HTMLInputElement>(element, 'avatar-background-2').click();
    type(byTestId<HTMLInputElement>(element, 'kid-nickname'), ' Lou ');

    byTestId(element, 'pin-set').querySelector('input')?.click();
    await fixture.whenStable();
    submit(element);
    await fixture.whenStable();
    expect(element.textContent).toContain('Bitte lege die Bilder-PIN fest');
    http.expectNone('/api/kids');

    tapPin(element, [1, 2, 3, 4]);
    await fixture.whenStable();
    expect(byTestId(element, 'pin-setup-prompt').textContent).toContain('noch einmal');
    tapPin(element, [1, 2, 3, 5]);
    await fixture.whenStable();
    expect(element.textContent).toContain('nicht gleich');
    tapPin(element, [1, 2, 3, 4]);
    await fixture.whenStable();
    tapPin(element, [1, 2, 3, 4]);
    await fixture.whenStable();
    expect(byTestId(element, 'pin-setup-prompt').textContent).toContain('festgelegt');

    submit(element);
    const req = http.expectOne('/api/kids');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nickname: 'Lou',
      avatar: { animal: 'owl', accessory: 'bow', background: '#C3F0C8' },
      startClass: 'KG1',
      language: 'de-CH',
      dailyLimitMinutes: null,
      soundEnabled: true,
      readAloud: 'auto',
      pin: [1, 2, 3, 4],
    });
    req.flush({ ...KID, id: 'new' });
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith('/parent');
  });

  it('edits a kid and removes the PIN', async () => {
    setup('k1');
    const { element, fixture } = await renderComponent(KidForm);
    http.expectOne('/api/kids').flush([KID]);
    await settle(fixture);
    expect(byTestId<HTMLInputElement>(element, 'kid-nickname').value).toBe('Mia');
    expect(byTestId(element, 'pin-keep')).toBeTruthy();

    byTestId(element, 'pin-none').querySelector('input')?.click();
    await fixture.whenStable();
    submit(element);
    const req = http.expectOne('/api/kids/k1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toMatchObject({ nickname: 'Mia', dailyLimitMinutes: 30, pin: null });
    req.flush(KID);
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith('/parent');
  });

  it('keeps the PIN by default when editing', async () => {
    setup('k1');
    const { element, fixture } = await renderComponent(KidForm);
    http.expectOne('/api/kids').flush([KID]);
    await settle(fixture);
    submit(element);
    const req = http.expectOne('/api/kids/k1');
    expect('pin' in req.request.body).toBe(false);
    req.flush(errorBody('AVATAR_INVALID', 400), { status: 400, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).toContain('Avatar');
  });

  it('reports an unknown kid', async () => {
    setup('missing');
    const { element, fixture } = await renderComponent(KidForm);
    http.expectOne('/api/kids').flush([KID]);
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).toContain('gibt es nicht mehr');
  });

  it('reports load failures', async () => {
    setup('k1');
    const { element, fixture } = await renderComponent(KidForm);
    http.expectOne('/api/kids').flush(null, { status: 500, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'form-error')).toBeTruthy();
  });
});
