// SPDX-License-Identifier: FSL-1.1-MIT

import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { transformCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/counterfactual-safes.utils';
import type { CreateCounterfactualSafeDto } from '@/modules/counterfactual-safes/routes/entities/create-counterfactual-safe.dto.entity';
import type { DeleteCounterfactualSafeDto } from '@/modules/counterfactual-safes/routes/entities/delete-counterfactual-safe.dto.entity';
import type { GetCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/entities/get-counterfactual-safe.dto.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

@Injectable()
export class CounterfactualSafesService {
  public constructor(
    @Inject(ICounterfactualSafesRepository)
    private readonly counterfactualSafesRepository: ICounterfactualSafesRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
  ) {}

  public async create(args: {
    authPayload: AuthPayload;
    payload: Array<CreateCounterfactualSafeDto>;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    await this.assertNoneDeployed(args.payload);

    return await this.counterfactualSafesRepository.create({
      creatorId: userId,
      payload: args.payload.map((item) => ({
        chainId: item.chainId,
        address: item.address,
        factoryAddress: item.factoryAddress,
        masterCopy: item.masterCopy,
        saltNonce: item.saltNonce,
        safeVersion: item.safeVersion,
        threshold: item.threshold,
        owners: item.owners,
        fallbackHandler: item.fallbackHandler ?? null,
        setupTo: item.to ?? null,
        setupData: item.data,
        paymentToken: item.paymentToken ?? null,
        payment: item.payment ?? null,
        paymentReceiver: item.paymentReceiver ?? null,
      })),
    });
  }

  public async get(
    authPayload: AuthPayload,
  ): Promise<GetCounterfactualSafesResponse> {
    const userId = getAuthenticatedUserIdOrFail(authPayload);

    const counterfactualSafes =
      await this.counterfactualSafesRepository.findByUserId({
        userId,
      });

    return {
      safes: transformCounterfactualSafesResponse(counterfactualSafes),
    };
  }

  public async delete(args: {
    authPayload: AuthPayload;
    payload: Array<DeleteCounterfactualSafeDto>;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

    await this.counterfactualSafesRepository.delete({
      userId,
      payload: args.payload,
    });
  }

  // Reject the whole request if any submitted Safe is already deployed —
  // counterfactual rows must only hold undeployed Safes. Fail open on error.
  private async assertNoneDeployed(
    payload: Array<CreateCounterfactualSafeDto>,
  ): Promise<void> {
    const deploymentChecks = await Promise.all(
      payload.map(async (item) => {
        try {
          return await this.safeRepository.isSafe({
            chainId: item.chainId,
            address: item.address,
          });
        } catch {
          return false;
        }
      }),
    );

    if (deploymentChecks.some(Boolean)) {
      throw new ConflictException(
        'One or more Safes are already deployed and cannot be saved as counterfactual.',
      );
    }
  }
}
