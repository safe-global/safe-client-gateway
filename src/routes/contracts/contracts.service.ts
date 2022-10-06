import { Inject, Injectable } from '@nestjs/common';
import { ContractsRepository } from '../../domain/contracts/contracts.repository';
import { IContractsRepository } from '../../domain/contracts/contracts.repository.interface';
import { Contract } from '../../domain/contracts/entities/contract.entity';

@Injectable()
export class ContractsService {
  constructor(
    @Inject(IContractsRepository)
    private readonly contractsRepository: ContractsRepository,
  ) {}

  async getContract(
    chainId: string,
    contractAddress: string,
  ): Promise<Contract> {
    return this.contractsRepository.getContract(chainId, contractAddress);
  }
}
