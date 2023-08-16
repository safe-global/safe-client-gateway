import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository.interface';
import { DataDecoded } from './entities/data-decoded.entity';
import { GetDataDecodedDto } from './entities/get-data-decoded.dto.entity';
import { HumanDescriptionsMapper } from '../transactions/mappers/common/human-descriptions.mapper';

@Injectable()
export class DataDecodedService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
    private readonly humanDescriptionsMapper: HumanDescriptionsMapper,
  ) {}

  async getDataDecoded(args: {
    chainId: string;
    getDataDecodedDto: GetDataDecodedDto;
  }): Promise<DataDecoded> {
    const [dataDecoded, humanDescription] = await Promise.all([
      this.dataDecodedRepository.getDataDecoded({
        chainId: args.chainId,
        data: args.getDataDecodedDto.data,
        to: args.getDataDecodedDto.to,
      }),

      this.humanDescriptionsMapper.mapHumanDescription(
        args.getDataDecodedDto.to,
        args.getDataDecodedDto.data,
        args.chainId,
        null,
      ),
    ]);

    return { ...dataDecoded, humanDescription };
  }
}
