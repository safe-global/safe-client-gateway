// SPDX-License-Identifier: FSL-1.1-MIT
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import type { CreateCounterfactualSafeDto } from '@/modules/counterfactual-safes/routes/entities/create-counterfactual-safe.dto.entity';
import type { DeleteCounterfactualSafeDto } from '@/modules/counterfactual-safes/routes/entities/delete-counterfactual-safe.dto.entity';
import type { GetCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/entities/get-counterfactual-safe.dto.entity';
import { transformCounterfactualSafesResponse } from '@/modules/counterfactual-safes/routes/counterfactual-safes.utils';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class CounterfactualSafesService {
  public constructor(
    @Inject(ICounterfactualSafesRepository)
    private readonly counterfactualSafesRepository: ICounterfactualSafesRepository,
  ) {}

  public async create(args: {
    authPayload: AuthPayload;
    payload: Array<CreateCounterfactualSafeDto>;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);

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
      await this.counterfactualSafesRepository.findByCreatorId({
        creatorId: userId,
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
      creatorId: userId,
      payload: args.payload,
    });
  }
}
