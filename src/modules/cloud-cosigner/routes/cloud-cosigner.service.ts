// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import type { z } from 'zod';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { ICloudCosignerRepository } from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import { CloudCosignerPolicyService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-policy.service';
import type {
  CloudCosignerInfoDto,
  SafeCloudCosignerStatusDto,
} from '@/modules/cloud-cosigner/routes/entities/cloud-cosigner-info.dto.entity';
import type {
  CloudCosignerPolicyDto,
  UpdateCloudCosignerPolicySchema,
} from '@/modules/cloud-cosigner/routes/entities/cloud-cosigner-policy.dto.entity';
import { CloudCosignerReviewDto } from '@/modules/cloud-cosigner/routes/entities/cloud-cosigner-review.dto.entity';

@Injectable()
export class CloudCosignerService {
  constructor(
    @Inject(CloudCosignerPolicyService)
    private readonly policyService: CloudCosignerPolicyService,
    @Inject(ICloudCosignerRepository)
    private readonly cloudCosignerRepository: ICloudCosignerRepository,
  ) {}

  public async getInfo(): Promise<CloudCosignerInfoDto> {
    return {
      address: await this.policyService.getCosignerAddress(),
      defaultPolicy: this.policyService.getDefaultPolicy(),
    };
  }

  public getSafeStatus(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<SafeCloudCosignerStatusDto> {
    return this.policyService.getSafeStatus(args);
  }

  public async updatePolicy(args: {
    chainId: string;
    safeAddress: Address;
    body: z.infer<typeof UpdateCloudCosignerPolicySchema>;
  }): Promise<CloudCosignerPolicyDto> {
    const stored = await this.policyService.updatePolicy({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      ...args.body,
    });
    return {
      valueThresholdUsd: stored.valueThresholdUsd,
      reviewUnknownContracts: stored.reviewUnknownContracts,
      instructions: stored.instructions,
    };
  }

  public async getReview(args: {
    chainId: string;
    safeTxHash: Hex;
  }): Promise<CloudCosignerReviewDto> {
    const review = await this.cloudCosignerRepository.getReview(args);
    if (!review) {
      throw new HttpExceptionNoLog('Review not found', HttpStatus.NOT_FOUND);
    }
    return CloudCosignerReviewDto.fromDomain(review);
  }
}
