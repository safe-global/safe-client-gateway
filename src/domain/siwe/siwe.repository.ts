import { ISiweApi } from '@/domain/interfaces/siwe-api.interface';
import { ISiweRepository } from '@/domain/siwe/siwe.repository.interface';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyMessage } from 'viem';
import { generateSiweNonce, SiweMessage } from 'viem/siwe';
import { SiweMessageSchema } from '@/domain/siwe/entities/siwe-message.entity';

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
    signature: `0x${string}`;
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

    let isValidSignature: boolean;
    try {
      isValidSignature = await verifyMessage({
        message: args.message,
        signature: args.signature,
        address: result.data.address,
      });
    } catch {
      isValidSignature = false;
    }

    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid signature');
    }

    return result.data;
  }

  // TODO: Modify the following to use the above getValidatedSiweMessage instead
  /**
   * Verifies the validity of a signed message:
   *
   * 1. Ensure the message itself is not before or after validity period.
   * 2. Ensure the desired expiration time is within the max validity period.
   * 3. Verify the signature.
   * 4. Ensure the nonce was generated by us/is not a replay attack.
   *
   * @param args.message - SiWe message
   * @param args.signature - signature from signing {@link args.message}
   *
   * @returns boolean - whether the signed message is valid
   */
  async isValidMessage(args: {
    message: string;
    signature: `0x${string}`;
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
