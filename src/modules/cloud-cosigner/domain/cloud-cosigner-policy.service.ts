// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type Address, type Hex, verifyMessage } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { ICloudCosignerRepository } from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import type {
  CloudCosignerPolicy,
  SafeCloudCosignerPolicy,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';
import type { SafeCosignerStatus } from '@/modules/cloud-cosigner/domain/entities/safe-cosigner-status.entity';
import { ICosignerSigner } from '@/modules/cloud-cosigner/domain/signers/cosigner-signer.interface';
import { buildPolicyMessage } from '@/modules/cloud-cosigner/domain/utils/policy-message';
import { toPolicy } from '@/modules/cloud-cosigner/domain/utils/to-policy';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

const MS_PER_SECOND = 1_000;

/**
 * Owner-facing side of the cosigner: which address to add as an owner, and
 * the per-Safe policy the review service applies.
 */
@Injectable()
export class CloudCosignerPolicyService {
  private readonly defaultPolicy: CloudCosignerPolicy;
  private readonly policySignatureMaxAgeMs: number;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(ICloudCosignerRepository)
    private readonly cloudCosignerRepository: ICloudCosignerRepository,
    @Inject(ICosignerSigner) private readonly signer: ICosignerSigner,
    @Inject(ISafeRepository) private readonly safeRepository: ISafeRepository,
  ) {
    this.defaultPolicy = {
      valueThresholdUsd: this.configurationService.getOrThrow<number>(
        'cloudCosigner.defaultPolicy.valueThresholdUsd',
      ),
      reviewUnknownContracts: this.configurationService.getOrThrow<boolean>(
        'cloudCosigner.defaultPolicy.reviewUnknownContracts',
      ),
      instructions: null,
    };
    this.policySignatureMaxAgeMs =
      MS_PER_SECOND *
      this.configurationService.getOrThrow<number>(
        'cloudCosigner.policySignatureMaxAgeSeconds',
      );
  }

  public getCosignerAddress(): Promise<Address> {
    return this.signer.getAddress();
  }

  public getDefaultPolicy(): CloudCosignerPolicy {
    return this.defaultPolicy;
  }

  /**
   * The policy in force for a Safe: the stored one, or the defaults.
   */
  public async getEffectivePolicy(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<CloudCosignerPolicy> {
    const stored = await this.cloudCosignerRepository.getPolicy(args);
    return stored ? toPolicy(stored) : this.defaultPolicy;
  }

  public async getSafeStatus(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<SafeCosignerStatus> {
    const [cosignerAddress, isEnabled, storedPolicy] = await Promise.all([
      this.signer.getAddress(),
      this.isCosignerOwner(args),
      this.cloudCosignerRepository.getPolicy(args),
    ]);
    return {
      cosignerAddress,
      isEnabled,
      policy: storedPolicy ? toPolicy(storedPolicy) : this.defaultPolicy,
      isDefaultPolicy: storedPolicy === null,
    };
  }

  /**
   * Stores a Safe's policy. Identity comes from recovering the EIP-191
   * signature over the canonical policy message; the signer must be a current
   * owner and the message must be recent, so a captured request cannot be
   * replayed later to reinstate an old policy.
   */
  public async updatePolicy(args: {
    chainId: string;
    safeAddress: Address;
    policy: CloudCosignerPolicy;
    signer: Address;
    signature: Hex;
    issuedAt: Date;
  }): Promise<SafeCloudCosignerPolicy> {
    const age = Math.abs(Date.now() - args.issuedAt.getTime());
    if (age > this.policySignatureMaxAgeMs) {
      throw new HttpExceptionNoLog(
        'Policy signature expired',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const message = buildPolicyMessage({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      issuedAt: args.issuedAt.toISOString(),
      policy: args.policy,
    });
    // A malformed signature is a client error, reported as invalid below.
    const isValid = await verifyMessage({
      address: args.signer,
      message,
      signature: args.signature,
    }).catch(() => false);
    if (!isValid) {
      throw new HttpExceptionNoLog(
        'Invalid policy signature',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const isOwner = await this.safeRepository.isOwner({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      address: args.signer,
    });
    if (!isOwner) {
      throw new HttpExceptionNoLog(
        'Signer is not an owner of the Safe',
        HttpStatus.FORBIDDEN,
      );
    }
    return this.cloudCosignerRepository.upsertPolicy(args);
  }

  private async isCosignerOwner(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<boolean> {
    const address = await this.signer.getAddress();
    try {
      return await this.safeRepository.isOwner({ ...args, address });
    } catch (error) {
      this.loggingService.warn({
        type: LogType.CloudCosignerEvent,
        message: `Could not read Safe owners: ${asError(error).message}`,
        ...args,
      });
      return false;
    }
  }
}
