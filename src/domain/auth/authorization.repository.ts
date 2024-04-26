import { Injectable, UnauthorizedException } from '@nestjs/common';
import { IAuthorizationRepository } from '@/domain/auth/authorization.repository.interface';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';

@Injectable()
export class AuthorizationRepository implements IAuthorizationRepository {
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
}
