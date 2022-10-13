import { Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { DataDecoded } from '../../domain/data-decoder/entities/data-decoded.entity';

@Injectable()
export class DataDecodedService {
  constructor(private readonly dataDecodedRepository: DataDecodedRepository) {}

  async decode(
    chainId: string,
    data: string,
    to: string,
  ): Promise<DataDecoded> {
    return this.dataDecodedRepository.decode(chainId, data, to);
  }
}
