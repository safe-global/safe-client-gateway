import { faker } from '@faker-js/faker';
import { DataDecodedRepository } from '../../domain/data-decoder/data-decoded.repository';
import dataDecodedFactory from '../../domain/data-decoder/entities/__tests__/data-decoded.factory';
import { DataDecodedService } from './data-decoded.service';
import createDataDecodedDtoFactory from './__tests__/create-data-decoded.dto.factory';

const mockDataDecodedRepository = jest.mocked({
  getDataDecoded: jest.fn(),
} as unknown as DataDecodedRepository);

describe('DataDecoded Service', () => {
  const service: DataDecodedService = new DataDecodedService(
    mockDataDecodedRepository,
  );

  it('should call repository for data decoding', async () => {
    const chainId = faker.datatype.string();
    const dataDecoded = dataDecodedFactory();
    const createDataDecodedDto = createDataDecodedDtoFactory();
    mockDataDecodedRepository.getDataDecoded.mockResolvedValueOnce(dataDecoded);

    const actual = await service.getDataDecoded(chainId, createDataDecodedDto);

    expect(actual).toBe(dataDecoded);
    expect(mockDataDecodedRepository.getDataDecoded).toBeCalledTimes(1);
  });
});
