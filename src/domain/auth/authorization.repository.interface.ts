import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';

export const IAuthorizationRepository = Symbol('IAuthorizationRepository');

export interface IAuthorizationRepository {
  assertChainAndSigner(args: {
    chainId: string;
    signerAddress: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): void;
}
