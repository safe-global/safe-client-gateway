import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository.interface';
import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';

@Injectable()
export class DataDecodedService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
  ) {}

  async getDataDecoded(args: {
    chainId: string;
    getDataDecodedDto: TransactionDataDto;
  }): Promise<DataDecoded> {
    return this.dataDecodedRepository.getDataDecoded({
      chainId: args.chainId,
      data: args.getDataDecodedDto.data,
      to: args.getDataDecodedDto.to,
    });
  }
}
