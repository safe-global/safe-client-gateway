import { Inject, Injectable } from '@nestjs/common';
import { ContractsRepository } from '@/modules/contracts/domain/contracts.repository';
import { IContractsRepository } from '@/modules/contracts/domain/contracts.repository.interface';
import { type Contract } from '@/modules/contracts/domain/entities/contract.entity';
import { ContractMapper } from '@/modules/contracts/routes/mappers/contract.mapper';
import type { Address } from 'viem';

@Injectable()
export class ContractsService {
  constructor(
    @Inject(IContractsRepository)
    private readonly contractsRepository: ContractsRepository,
    private readonly contractMapper: ContractMapper,
  ) {}

  async getContract(args: {
    chainId: string;
    contractAddress: Address;
  }): Promise<Contract> {
    const contract = await this.contractsRepository.getContract(args);
    return this.contractMapper.map(contract);
  }
}
