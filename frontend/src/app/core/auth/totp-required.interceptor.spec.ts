import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { errorBody, provideAppTesting } from '../../../testing/app-testing';

describe('totpRequiredInterceptor', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  const totpRequired = () =>
    [errorBody('TOTP_REQUIRED', 403), { status: 403, statusText: 'Forbidden' }] as const;

  it('sends admins to the TOTP setup and still fails the request', async () => {
    const result = firstValueFrom(TestBed.inject(HttpClient).get('/api/admin/stats'));
    http.expectOne('/api/admin/stats').flush(...totpRequired());
    await expect(result).rejects.toMatchObject({ code: 'TOTP_REQUIRED' });
    expect(navigate).toHaveBeenCalledWith(['/parent/account'], {
      queryParams: { notice: 'totp-required' },
      fragment: 'totp',
    });
  });

  it('stays put on the account page and ignores other errors', async () => {
    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/parent/account');
    const client = TestBed.inject(HttpClient);
    const first = firstValueFrom(client.get('/api/admin/users'));
    http.expectOne('/api/admin/users').flush(...totpRequired());
    await expect(first).rejects.toBeTruthy();

    const other = firstValueFrom(client.get('/api/admin/users'));
    http.expectOne('/api/admin/users').flush(null, { status: 500, statusText: 'x' });
    await expect(other).rejects.toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
