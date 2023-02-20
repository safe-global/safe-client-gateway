import { faker } from '@faker-js/faker';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { DataDecodedParameter } from '../../domain/data-decoder/entities/data-decoded.entity';
import { dataDecodedBuilder } from '../../domain/data-decoder/entities/__tests__/data-decoded.builder';
import { DataDecodedService } from './data-decoded.service';
import { DataDecodedParameter as ApiDataDecodedParameter } from './entities/data-decoded-parameter.entity';
import { DataDecoded } from './entities/data-decoded.entity';
import getDataDecodedDtoFactory from './__tests__/get-data-decoded.dto.factory';

const mockDataDecodedRepository = jest.mocked({
  getDataDecoded: jest.fn(),
} as unknown as DataDecodedRepository);

describe('DataDecoded Service', () => {
  const service: DataDecodedService = new DataDecodedService(
    mockDataDecodedRepository,
  );

  it('should call repository for data decoding and serialize', async () => {
    const chainId = faker.datatype.string();
    const dataDecoded = dataDecodedBuilder().build();
    const getDataDecodedDto = getDataDecodedDtoFactory();
    mockDataDecodedRepository.getDataDecoded.mockResolvedValueOnce(dataDecoded);

    const actual = await service.getDataDecoded(chainId, getDataDecodedDto);

    expect(actual).toStrictEqual(
      new DataDecoded(
        dataDecoded.method,
        getExpectedSerializedParameters(dataDecoded.parameters),
      ),
    );
    expect(mockDataDecodedRepository.getDataDecoded).toBeCalledTimes(1);
  });
});

function getExpectedSerializedParameters(
  parameters: DataDecodedParameter[] | null,
): ApiDataDecodedParameter[] {
  return parameters
    ? parameters.map(
        (parameter) =>
          new ApiDataDecodedParameter(
            parameter.name,
            parameter.type,
            parameter.value,
            parameter.valueDecoded,
          ),
      )
    : [];
}
