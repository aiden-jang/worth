import type { AuthUser } from '@aidenjang/auth-client';

export type AppEnv = {
  Bindings: Env;
  Variables: { ownerId: string; user: AuthUser };
};
