import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { getAddress, hashMessage } from 'viem';
import { SafeRepository } from '@/domain/safe/safe.repository';
import { ISafeRepository } from '@/domain/safe/safe.repository.interface';
import { SignaturesRepository } from '@/domain/signatures/signatures.repository';
import { ISignaturesRepository } from '@/domain/signatures/signatures.repository.interace';

@Injectable()
export class EmailsGuard implements CanActivate {
  constructor(
    @Inject(ISafeRepository)
    private readonly safeRepository: SafeRepository,
    @Inject(ISignaturesRepository)
    private readonly signaturesRepository: SignaturesRepository,
  ) {}

  private getMessageHash(args: {
    chainId: string;
    safeAddress: string;
    timestamp: number;
  }): string {
    const message =
      args.chainId + getAddress(args.safeAddress) + args.timestamp;

    return hashMessage(message);
  }

  private async isVerifiedOwner(args: {
    chainId: string;
    safeAddress: string;
    signature: string;
    timestamp: number;
  }): Promise<boolean> {
    const { owners } = await this.safeRepository.getSafe({
      chainId: args.chainId,
      address: args.safeAddress,
    });

    const hash = this.getMessageHash(args);

    return Promise.all(
      owners.map((owner) => {
        return this.signaturesRepository.verifySignature({
          address: owner,
          message: hash,
          signature: args.signature,
        });
      }),
    )
      .then((results) => results.some(Boolean))
      .catch(() => false);
  }

  canActivate(context: ExecutionContext): Promise<boolean> {
    // TODO: Add types from controller method(s)
    const { params, body } = context.switchToHttp().getRequest();

    return this.isVerifiedOwner({
      chainId: params.chainId,
      safeAddress: params.safeAddress,
      signature: body.signature,
      timestamp: body.timestamp,
    });
  }
}
