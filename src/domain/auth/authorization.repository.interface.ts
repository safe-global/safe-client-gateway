import { AuthorizationRepository } from '@/domain/auth/authorization.repository';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { Module } from '@nestjs/common';

export const IAuthorizationRepository = Symbol('IAuthorizationRepository');

export interface IAuthorizationRepository {
  assertChainAndSigner(args: {
    chainId: string;
    signerAddress: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): void;

  assertSafeOwner(args: {
    safeAddress: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): Promise<void>;
}

@Module({
  imports: [SafeRepositoryModule],
  providers: [
    {
      provide: IAuthorizationRepository,
      useClass: AuthorizationRepository,
    },
  ],
  exports: [IAuthorizationRepository],
})
export class AuthorizationRepositoryModule {}
