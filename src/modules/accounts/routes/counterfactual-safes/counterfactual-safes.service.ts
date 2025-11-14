import { ICounterfactualSafesRepository } from '@/modules/accounts/domain/counterfactual-safes/counterfactual-safes.repository.interface';
import { CounterfactualSafe as DomainCounterfactualSafe } from '@/modules/accounts/domain/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/modules/accounts/domain/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { CounterfactualSafe } from '@/modules/accounts/routes/counterfactual-safes/entities/counterfactual-safe.entity';
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';

@Injectable()
export class CounterfactualSafesService {
  constructor(
    @Inject(ICounterfactualSafesRepository)
    private readonly repository: ICounterfactualSafesRepository,
  ) {}

  async getCounterfactualSafe(args: {
    address: Address;
    chainId: string;
    predictedAddress: Address;
  }): Promise<CounterfactualSafe> {
    const domainCounterfactualSafe =
      await this.repository.getCounterfactualSafe(args);
    return this.mapCounterfactualSafe(domainCounterfactualSafe);
  }

  async getCounterfactualSafes(
    address: Address,
  ): Promise<Array<CounterfactualSafe>> {
    const domainCounterfactualSafes =
      await this.repository.getCounterfactualSafes(address);
    return domainCounterfactualSafes.map((counterfactualSafe) =>
      this.mapCounterfactualSafe(counterfactualSafe),
    );
  }

  async createCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: Address;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe> {
    const domainCounterfactualSafe =
      await this.repository.createCounterfactualSafe(args);
    return this.mapCounterfactualSafe(domainCounterfactualSafe);
  }

  async deleteCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
    predictedAddress: Address;
  }): Promise<void> {
    await this.repository.deleteCounterfactualSafe(args);
  }

  async deleteCounterfactualSafes(args: {
    authPayload: AuthPayload;
    address: Address;
  }): Promise<void> {
    await this.repository.deleteCounterfactualSafes(args);
  }

  private mapCounterfactualSafe(
    domainCounterfactualSafe: DomainCounterfactualSafe,
  ): CounterfactualSafe {
    return new CounterfactualSafe(
      domainCounterfactualSafe.chain_id,
      domainCounterfactualSafe.creator,
      domainCounterfactualSafe.fallback_handler,
      domainCounterfactualSafe.owners,
      domainCounterfactualSafe.predicted_address,
      domainCounterfactualSafe.salt_nonce,
      domainCounterfactualSafe.singleton_address,
      domainCounterfactualSafe.threshold,
    );
  }
}
