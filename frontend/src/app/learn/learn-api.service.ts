import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/http/api.service';
import {
  AnswerResponse,
  AnyAnswer,
  FinishRunResponse,
  MapResponse,
  PracticeCatalogResponse,
  StartRunResponse,
} from './learn.models';

/** The kid-side learning API (docs/internal/learning-engine.md §3). */
@Injectable({ providedIn: 'root' })
export class LearnApi {
  private readonly api = inject(ApiService);

  map(): Promise<MapResponse> {
    return firstValueFrom(this.api.get<MapResponse>('learn/map'));
  }

  startLevel(levelId: string): Promise<StartRunResponse> {
    return firstValueFrom(
      this.api.post<StartRunResponse>(`learn/levels/${encodeURIComponent(levelId)}/runs`),
    );
  }

  practiceCatalog(): Promise<PracticeCatalogResponse> {
    return firstValueFrom(this.api.get<PracticeCatalogResponse>('learn/practice'));
  }

  /** A topic run, or `null` for "Murmeli wählt", a mix picked by the server. */
  startPractice(topic: string | null = null): Promise<StartRunResponse> {
    return firstValueFrom(
      this.api.post<StartRunResponse>('learn/practice/runs', topic === null ? {} : { topic }),
    );
  }

  answer(runId: string, index: number, answer: AnyAnswer): Promise<AnswerResponse> {
    return firstValueFrom(
      this.api.post<AnswerResponse>(`learn/runs/${encodeURIComponent(runId)}/answers`, {
        index,
        answer,
      }),
    );
  }

  finish(runId: string): Promise<FinishRunResponse> {
    return firstValueFrom(
      this.api.post<FinishRunResponse>(`learn/runs/${encodeURIComponent(runId)}/finish`),
    );
  }
}
