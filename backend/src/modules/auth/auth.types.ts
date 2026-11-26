import type { Request } from 'express';

export interface AuthContext {
  readonly userId: string;
  readonly familyId: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthContext;
}
