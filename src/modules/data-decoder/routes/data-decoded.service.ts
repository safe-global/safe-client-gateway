// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import type { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import type { DataDecoded } from '@/modules/data-decoder/routes/entities/data-decoded.entity';

@Injectable()
export class DataDecodedService {
  constructor(
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
  ) {}

  async getDataDecoded(args: {
    chainId: string;
    getDataDecodedDto: TransactionDataDto;
  }): Promise<DataDecoded> {
    return this.dataDecoderRepository.getDecodedData({
      chainId: args.chainId,
      data: args.getDataDecodedDto.data,
      to: args.getDataDecodedDto.to,
    });
  }
}
