import { ISiweApi } from '@/domain/interfaces/siwe-api.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { ISiweRepository } from '@/domain/siwe/siwe.repository.interface';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { verifyMessage } from 'viem';
import {
  generateSiweNonce,
  parseSiweMessage,
  validateSiweMessage,
  verifySiweMessage,
} from 'viem/siwe';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';

@Injectable()
export class SiweRepository implements ISiweRepository {
  private readonly maxValidityPeriodInSeconds: number;

  constructor(
    @Inject(ISiweApi)
    private readonly siweApi: ISiweApi,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
  ) {
    this.maxValidityPeriodInSeconds = this.configurationService.getOrThrow(
      'auth.maxValidityPeriodSeconds',
    );
  }

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
  }): Promise<boolean> {
    const message = parseSiweMessage(args.message);

    // Without nonce we can't verify whether a replay attack
    if (!message.nonce) {
      return false;
    }

    try {
      // Verifying message after notBefore and before expirationTime
      const isValidMessage = validateSiweMessage({
        message,
      });

      if (!isValidMessage || !message.chainId || !message.address) {
        return false;
      }

      // Expiration expectation does not exceed max validity period
      const isExpirationValid =
        !message.expirationTime ||
        message.expirationTime <=
          new Date(Date.now() + this.maxValidityPeriodInSeconds * 1_000);

      if (!isExpirationValid) {
        return false;
      }

      // Verify signature and nonce is cached (not a replay attack)
      const [isValidSignature, isNonceCached] = await Promise.all([
        this.isValidSignature({
          chainId: message.chainId.toString(),
          address: message.address,
          message: args.message,
          signature: args.signature,
        }),
        this.siweApi.getNonce(message.nonce).then(Boolean),
      ]);

      return isValidSignature && isNonceCached;
    } catch (e) {
      this.loggingService.debug(
        `Failed to verify SiWe message. message=${args.message}, error=${e}`,
      );
      return false;
    } finally {
      await this.siweApi.clearNonce(message.nonce);
    }
  }

  /**
   * Verifies signature of signed SiWe message, either by EOA or smart contract
   *
   * @param args.message - SiWe message
   * @param args.chainId - chainId of the blockchain
   * @param args.address - address of the signer
   * @param args.signature - signature from signing {@link args.message}
   *
   * @returns boolean - whether the signature is valid
   */
  private async isValidSignature(args: {
    message: string;
    chainId: string;
    address: `0x${string}`;
    signature: `0x${string}`;
  }): Promise<boolean> {
    // First check if valid signature of EOA as it can be done off chain
    const isValidEoaSignature = await verifyMessage(args).catch(() => false);
    if (isValidEoaSignature) {
      return true;
    }

    // Else, verify hash on-chain using ERC-6492 for smart contract accounts
    const blockchainApi = await this.blockchainApiManager.getBlockchainApi(
      args.chainId,
    );
    const client = blockchainApi.getClient();
    return verifySiweMessage(client, {
      message: args.message,
      signature: args.signature,
    });
  }
}
