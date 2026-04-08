// SPDX-License-Identifier: FSL-1.1-MIT
import type { IBlockchainRepository } from '@/modules/blockchain/domain/blockchain.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FakeBlockchainRepository implements IBlockchainRepository {
  clearApi = jest.fn();
}
