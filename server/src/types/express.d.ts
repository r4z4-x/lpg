import type { Role } from '../constants/roles';

/** The authenticated principal attached by auth middleware (real implementation in M1). */
export interface AuthUser {
  id: string;
  role: Role;
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Correlation id for logging/tracing. */
      requestId?: string;
    }
  }
}

export {};
