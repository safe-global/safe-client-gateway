import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IAuthorizationRepository } from '@/domain/auth/authorization.repository.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';

@Injectable()
export class AuthorizationRepository implements IAuthorizationRepository {
  constructor(
    @Inject(ISafeRepository) private safeRepository: ISafeRepository,
  ) {}

  assertChainAndSigner(args: {
    chainId: string;
    signerAddress: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): void {
    if (
      !args.authPayload ||
      args.authPayload.chain_id !== args.chainId ||
      // Ennsure a mixture of (non-)checksummed addresses match
      args.authPayload.signer_address.toLowerCase() !==
        args.signerAddress.toLowerCase()
    ) {
      throw new UnauthorizedException();
    }
  }

  async assertSafeOwner(args: {
    safeAddress: `0x${string}`;
    authPayload: AuthPayload | undefined;
  }): Promise<void> {
    if (!args.authPayload) {
      throw new UnauthorizedException();
    }
    const isOwner = await this.safeRepository
      .isOwner({
        safeAddress: args.safeAddress,
        chainId: args.authPayload.chain_id,
        address: args.authPayload.signer_address,
      })
      // Swallow error so as to not leak information
      .catch(() => false);
    if (!isOwner) {
      throw new UnauthorizedException();
    }
  }
}
