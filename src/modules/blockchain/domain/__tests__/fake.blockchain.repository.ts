// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import type { IBlockchainRepository } from '@/modules/blockchain/domain/blockchain.repository.interface';

@Injectable()
export class FakeBlockchainRepository implements IBlockchainRepository {
  clearApi = jest.fn();
}
