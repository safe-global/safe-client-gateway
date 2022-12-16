import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository.interface';
import {
  CreateDataDecodedDto,
  isCreateDataDecodeDto,
} from './entities/create-data-decoded.dto';
import { DataDecoded } from './entities/data-decoded.entity';

@Injectable()
export class DataDecodedService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
  ) {}

  async getDataDecoded(
    chainId: string,
    createDataDecodedDto: CreateDataDecodedDto,
  ): Promise<DataDecoded> {
    if (!isCreateDataDecodeDto(createDataDecodedDto)) {
      throw new HttpException(
        'Invalid payload',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const { data, to } = createDataDecodedDto;
    const dataDecoded = await this.dataDecodedRepository.getDataDecoded(
      chainId,
      data,
      to,
    );
    const parameters = dataDecoded.parameters?.map(
      ({ type: paramType, ...rest }) => ({ ...rest, paramType }),
    );
    return new DataDecoded(dataDecoded.method, parameters ?? null);
  }
}
