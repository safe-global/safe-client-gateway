import { Inject, Injectable } from '@nestjs/common';
import { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';
import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';

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
