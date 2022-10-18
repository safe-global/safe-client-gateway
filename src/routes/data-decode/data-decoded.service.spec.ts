import { faker } from '@faker-js/faker';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { DataDecodedParameter } from '../../domain/data-decoder/entities/data-decoded.entity';
import dataDecodedFactory from '../../domain/data-decoder/entities/__tests__/data-decoded.factory';
import { DataDecodedService } from './data-decoded.service';
import { DataDecodedParameter as ApiDataDecodedParameter } from './entities/data-decoded-parameter';
import createDataDecodedDtoFactory from './__tests__/create-data-decoded.dto.factory';

const mockDataDecodedRepository = jest.mocked({
  getDataDecoded: jest.fn(),
} as unknown as DataDecodedRepository);

describe('DataDecoded Service', () => {
  const service: DataDecodedService = new DataDecodedService(
    mockDataDecodedRepository,
  );

  it('should call repository for data decoding and serialize', async () => {
    const chainId = faker.datatype.string();
    const dataDecoded = dataDecodedFactory();
    const createDataDecodedDto = createDataDecodedDtoFactory();
    mockDataDecodedRepository.getDataDecoded.mockResolvedValueOnce(dataDecoded);

    const actual = await service.getDataDecoded(chainId, createDataDecodedDto);

    expect(actual).toStrictEqual({
      ...dataDecoded,
      parameters: getExpectedSerializedParameters(dataDecoded.parameters),
    });
    expect(mockDataDecodedRepository.getDataDecoded).toBeCalledTimes(1);
  });
});

function getExpectedSerializedParameters(
  parameters: DataDecodedParameter[] | undefined,
): ApiDataDecodedParameter[] {
  return parameters
    ? parameters.map(({ type: paramType, ...rest }) => ({ ...rest, paramType }))
    : [];
}
