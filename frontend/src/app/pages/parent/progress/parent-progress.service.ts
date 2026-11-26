import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ParentProgressResponse } from './parent-progress.types';

@Injectable({ providedIn: 'root' })
export class ParentProgressService {
  private readonly api = inject(ApiService);

  forKid(kidId: string): Promise<ParentProgressResponse> {
    return firstValueFrom(
      this.api.get<ParentProgressResponse>(`parent/kids/${encodeURIComponent(kidId)}/progress`),
    );
  }
}
