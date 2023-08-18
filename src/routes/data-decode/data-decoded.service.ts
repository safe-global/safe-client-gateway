import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository.interface';
import { DataDecoded } from './entities/data-decoded.entity';
import { GetDataDecodedDto } from './entities/get-data-decoded.dto.entity';
import { HumanDescriptionMapper } from '../transactions/mappers/common/human-description.mapper';
import { IConfigurationService } from '../../config/configuration.service.interface';

@Injectable()
export class DataDecodedService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly humanDescriptionMapper: HumanDescriptionMapper,
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

      this.configurationService.get('features.humanDescription')
        ? this.humanDescriptionMapper.mapHumanDescription(
            args.getDataDecodedDto.to,
            args.getDataDecodedDto.data,
            args.chainId,
            null,
          )
        : undefined,
    ]);

    return { ...dataDecoded, humanDescription };
  }
}
