import { Injectable } from '@nestjs/common';
import { DataDecoderRepository } from '../../domain/data-decoder/data-decoder.repository';
import { DataDecoded } from '../../domain/data-decoder/entities/data-decoded.entity';

@Injectable()
export class DataDecoderService {
  constructor(private readonly dataDecoderRepository: DataDecoderRepository) {}

  async decode(
    chainId: string,
    data: string,
    to: string,
  ): Promise<DataDecoded> {
    return this.dataDecoderRepository.decode(chainId, data, to);
  }
}
