export const IJwtService = Symbol('IJwtService');

export interface IJwtService {
  sign<T extends string | object>(
    payload: T,
    options?: {
      expiresIn?: number;
      notBefore?: number;
    },
  ): string;

  verify<T extends string | object>(token: string): T;
}
