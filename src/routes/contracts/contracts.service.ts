import { Inject, Injectable } from '@nestjs/common';
import { ContractsRepository } from '@/domain/contracts/contracts.repository';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { ContractMapper } from '@/routes/contracts/mappers/contract.mapper';
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
