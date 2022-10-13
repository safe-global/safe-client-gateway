import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository.interface';
import { CreateDataDecodedDto } from '../../domain/data-decoder/entities/create-data-decoded.dto';
import { DataDecoded } from '../../domain/data-decoder/entities/data-decoded.entity';

@Injectable()
export class DataDecodedService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
  ) {}

  async decode(
    chainId: string,
    createDataDecodedDto: CreateDataDecodedDto,
  ): Promise<DataDecoded> {
    const { data, to } = createDataDecodedDto;
    return this.dataDecodedRepository.decode(chainId, data, to);
  }
}
