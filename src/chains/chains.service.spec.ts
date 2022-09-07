import { ChainsService } from './chains.service';
import backboneFactory from './entities/__tests__/backbone.factory';
import { IChainsRepository } from '../domain/chains/chains.repository.interface';
import { IBackboneRepository } from '../domain/backbone/backbone.repository.interface';

const chainsRepository = {
  getChains: jest.fn(),
} as unknown as IChainsRepository;

const chainsRepositoryMock = jest.mocked(chainsRepository);

const backboneRepository = {
  getBackbone: jest.fn(),
} as unknown as IBackboneRepository;

const backboneRepositoryMock = jest.mocked(backboneRepository);

describe('ChainsService', () => {
  const service: ChainsService = new ChainsService(
    chainsRepositoryMock,
    backboneRepositoryMock,
  );

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should retrieve the backbone metadata', async () => {
    const chainId = '1';
    const backbone = backboneFactory();
    backboneRepositoryMock.getBackbone.mockResolvedValueOnce(backbone);

    const actual = await service.getBackbone(chainId);

    expect(actual).toBe(backbone);
    expect(backboneRepositoryMock.getBackbone).toBeCalledTimes(1);
  });
});
