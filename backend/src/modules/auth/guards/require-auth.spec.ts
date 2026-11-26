import { HttpException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth.types';
import { requireAuth } from './require-auth';

describe('requireAuth', () => {
  it('returns the auth context', () => {
    const auth = { userId: 'u', familyId: 'f' };

    expect(requireAuth({ auth } as AuthenticatedRequest)).toBe(auth);
  });

  it('throws 401 UNAUTHORIZED without one', () => {
    expect(() => requireAuth({} as AuthenticatedRequest)).toThrow(
      HttpException,
    );
  });
});
