import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository.interface';
import { DataDecodedParameter } from './entities/data-decoded-parameter.entity';
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
    const dataDecoded = await this.dataDecodedRepository.getDataDecoded(
      chainId,
      data,
      to,
    );
    const parameters: DataDecodedParameter[] | null =
      dataDecoded.parameters?.map(
        (dataDecodedParameter) =>
          new DataDecodedParameter(
            dataDecodedParameter.name,
            dataDecodedParameter.type,
            dataDecodedParameter.value,
            dataDecodedParameter.valueDecoded,
          ),
      ) ?? null;
    return new DataDecoded(dataDecoded.method, parameters);
  }
}
