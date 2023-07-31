import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository.interface';
import { DataDecoded } from './entities/data-decoded.entity';
import { GetDataDecodedDto } from './entities/get-data-decoded.dto.entity';

@Injectable()
export class DataDecodedService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
  ) {}

  async getDataDecoded(
    chainId: string,
    getDataDecodedDto: GetDataDecodedDto,
  ): Promise<DataDecoded> {
    const { data, to } = getDataDecodedDto;
    return this.dataDecodedRepository.getDataDecoded({ chainId, data, to });
  }
}
