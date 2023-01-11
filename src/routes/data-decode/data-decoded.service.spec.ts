import { faker } from '@faker-js/faker';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import { DataDecodedParameter } from '../../domain/data-decoder/entities/data-decoded.entity';
import { DataDecodedService } from './data-decoded.service';
import { DataDecodedParameter as ApiDataDecodedParameter } from './entities/data-decoded-parameter';
import { DataDecoded } from './entities/data-decoded.entity';
import createDataDecodedDtoFactory from './__tests__/create-data-decoded.dto.factory';
import { dataDecodedBuilder } from '../../domain/data-decoder/entities/__tests__/data-decoded.builder';

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
    const createDataDecodedDto = createDataDecodedDtoFactory();
    mockDataDecodedRepository.getDataDecoded.mockResolvedValueOnce(dataDecoded);

    const actual = await service.getDataDecoded(chainId, createDataDecodedDto);

    expect(actual).toStrictEqual(
      new DataDecoded(
        dataDecoded.method,
        getExpectedSerializedParameters(dataDecoded.parameters),
      ),
    );
    expect(mockDataDecodedRepository.getDataDecoded).toBeCalledTimes(1);
  });

  it('should throw an error on invalid payload', async () => {
    const chainId = faker.datatype.string();
    const createDataDecodedDto = createDataDecodedDtoFactory(
      undefined,
      faker.random.word(),
    );

    await expect(
      service.getDataDecoded(chainId, createDataDecodedDto),
    ).rejects.toThrow('Invalid payload');
  });

  it('should throw an error on invalid payload (2)', async () => {
    const chainId = faker.datatype.string();
    const createDataDecodedDto = createDataDecodedDtoFactory(
      faker.random.words(),
      faker.random.word(),
    );

    await expect(
      service.getDataDecoded(chainId, createDataDecodedDto),
    ).rejects.toThrow('Invalid payload');
  });
});

function getExpectedSerializedParameters(
  parameters: DataDecodedParameter[] | null,
): ApiDataDecodedParameter[] {
  return parameters
    ? parameters.map(({ type: paramType, ...rest }) => ({ ...rest, paramType }))
    : [];
}
