import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import fc from 'fast-check';
import { sha256Hex } from '../../../common/crypto/secure-token';
import type { Env } from '../../../config/env.schema';
import type { RefreshTokenEntity } from '../entities/refresh-token.entity';
import { SessionService } from './session.service';

type Row = RefreshTokenEntity;
type Where = Partial<Pick<Row, 'id' | 'familyId' | 'revoked' | 'tokenHash'>>;

const USER = { id: 'user-1', role: 'parent', disabled: false };

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(
    ([key, value]) => row[key as keyof Row] === value,
  );
}

/**
 * An in-memory refresh_tokens table with transactions that roll back.
 */
class FakeStore {
  rows: Row[] = [];
  private nextId = 1;

  readonly repository = {
    insert: (values: Partial<Row>) => {
      const id = `t${this.nextId++}`;
      this.rows.push({
        id,
        revoked: false,
        revokedReason: null,
        replacedBy: null,
        createdAt: new Date(),
        ...values,
      } as Row);
      return Promise.resolve({ identifiers: [{ id }] });
    },
    update: (where: Where, changes: Partial<Row>) => {
      const hits = this.rows.filter((row) => matches(row, where));
      this.rows = this.rows.map((row) =>
        hits.includes(row) ? { ...row, ...changes } : row,
      );
      return Promise.resolve({ affected: hits.length });
    },
    findOne: ({ where }: { where: Where }) => {
      const row = this.rows.find((candidate) => matches(candidate, where));
      return Promise.resolve(row ? { ...row, user: USER } : null);
    },
    findOneBy: (where: Where) =>
      Promise.resolve(this.rows.find((row) => matches(row, where)) ?? null),
  };

  readonly dataSource = {
    transaction: async (work: (manager: unknown) => Promise<unknown>) => {
      const snapshot = [...this.rows];
      try {
        return await work({ getRepository: () => this.repository });
      } catch (error) {
        this.rows = snapshot;
        throw error;
      }
    },
    query: (_sql: string, [familyId]: string[]) =>
      Promise.resolve([
        {
          active: this.rows.some(
            (row) => row.familyId === familyId && !row.revoked,
          ),
        },
      ]),
  };
}

function service(store: FakeStore): SessionService {
  return new SessionService(
    store.repository as never,
    store.dataSource as never,
    {
      get: () => Promise.resolve(null),
      set: () => Promise.resolve('OK'),
    } as never,
    { get: () => '30d' } as unknown as ConfigService<Env, true>,
  );
}

describe('SessionService rotation (property)', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation());
  afterEach(() => jest.restoreAllMocks());

  it('accepts only the newest token, and any reuse kills the whole family', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.nat(), { minLength: 1, maxLength: 12 }),
        async (picks) => {
          const store = new FakeStore();
          const sessions = service(store);
          const first = await sessions.start(USER.id, null);
          const issued = [first.refreshToken];
          let current = first.refreshToken;
          let compromised = false;

          for (const pick of picks) {
            const presented = issued[pick % issued.length];
            const result = await sessions.rotate(presented, null);

            if (compromised) {
              expect(result.status).not.toBe('rotated');
            } else if (presented === current) {
              expect(result.status).toBe('rotated');
              if (result.status === 'rotated') {
                current = result.session.refreshToken;
                issued.push(current);
              }
            } else {
              expect(result).toEqual({
                status: 'compromised',
                userId: USER.id,
              });
              compromised = true;
            }
          }

          const familyActive = await sessions.isFamilyActive(first.familyId);
          expect(familyActive).toBe(!compromised);
          if (compromised) {
            for (const token of issued) {
              expect((await sessions.rotate(token, null)).status).not.toBe(
                'rotated',
              );
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('stores exactly one live token per active family', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (rotations) => {
        const store = new FakeStore();
        const sessions = service(store);
        let token = (await sessions.start(USER.id, null)).refreshToken;

        for (let i = 0; i < rotations; i += 1) {
          const result = await sessions.rotate(token, null);
          if (result.status !== 'rotated') {
            throw new Error('rotation failed');
          }
          token = result.session.refreshToken;
        }

        const live = store.rows.filter((row) => !row.revoked);
        expect(live).toHaveLength(1);
        expect(live[0].tokenHash).toBe(sha256Hex(token));
        expect(
          store.rows.filter((row) => row.revokedReason === 'rotated'),
        ).toHaveLength(rotations);
      }),
      { numRuns: 50 },
    );
  });
});
