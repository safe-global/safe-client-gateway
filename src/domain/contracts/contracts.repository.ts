import { Injectable } from '@nestjs/common';
import { Contract } from './entities/contract.entity';

@Injectable()
export class ContractsRepository {
  getContract(chainId: string, contractAddress: string): Promise<Contract> {
    // TODO: implement this
    console.log(chainId, contractAddress);

    return Promise.resolve(<Contract>{
      address: 'foo',
      name: 'bar',
      displayName: 'foo',
      trustedForDelegateCall: false,
    });
  }
}
