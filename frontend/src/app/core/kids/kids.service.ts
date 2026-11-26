import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Kid, KidInput, PicturePin } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { ApiService } from '../http/api.service';

@Injectable({ providedIn: 'root' })
export class KidsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  list(): Promise<Kid[]> {
    return firstValueFrom(this.api.get<Kid[]>('kids'));
  }

  async get(id: string): Promise<Kid | null> {
    return (await this.list()).find((kid) => kid.id === id) ?? null;
  }

  create(input: KidInput): Promise<Kid> {
    return firstValueFrom(this.api.post<Kid>('kids', input));
  }

  update(id: string, patch: Partial<KidInput>): Promise<Kid> {
    return firstValueFrom(this.api.patch<Kid>(`kids/${encodeURIComponent(id)}`, patch));
  }

  remove(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`kids/${encodeURIComponent(id)}`));
  }

  async activate(id: string, pin?: PicturePin): Promise<Kid> {
    const kid = await firstValueFrom(
      this.api.post<Kid>(`kids/${encodeURIComponent(id)}/activate`, pin ? { pin } : {}),
    );
    this.auth.setActiveKid(kid);
    return kid;
  }

  async deactivate(): Promise<void> {
    await firstValueFrom(this.api.post<void>('kids/deactivate'));
    this.auth.setActiveKid(null);
  }
}
