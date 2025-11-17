import { ISiweApi } from '@/domain/interfaces/siwe-api.interface';
import { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyMessage } from 'viem';
import { generateSiweNonce, SiweMessage } from 'viem/siwe';
import { SiweMessageSchema } from '@/modules/siwe/domain/entities/siwe-message.entity';
import type { Hex } from 'viem';

@Injectable()
export class SiweRepository implements ISiweRepository {
  constructor(
    @Inject(ISiweApi)
    private readonly siweApi: ISiweApi,
  ) {}

  /**
   * Generates a unique nonce and stores it in cache for later verification.
   *
   * @returns nonce - unique string to be signed
   */
  async generateNonce(): Promise<{ nonce: string }> {
    const nonce = generateSiweNonce();

    await this.siweApi.storeNonce(nonce);

    return {
      nonce,
    };
  }

  async getValidatedSiweMessage(args: {
    message: string;
    signature: Hex;
  }): Promise<SiweMessage> {
    const result = SiweMessageSchema.safeParse(args.message);
    if (!result.success) {
      throw new UnauthorizedException('Invalid message');
    }

    const cachedNonce = await this.siweApi.getNonce(result.data.nonce);
    if (!cachedNonce) {
      throw new UnauthorizedException('Invalid nonce');
    }

    await this.siweApi.clearNonce(result.data.nonce);

    const isValidSignature = await verifyMessage({
      message: args.message,
      signature: args.signature,
      address: result.data.address,
    }).catch(() => false);

    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid signature');
    }

    return result.data;
  }
}
