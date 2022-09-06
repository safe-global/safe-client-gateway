import { ChainsService } from './chains.service';
import backboneFactory from './entities/__tests__/backbone.factory';
import { IDomainRepository } from '../domain/domain.repository.interface';

const repository = {
  getBackbone: jest.fn(),
} as unknown as IDomainRepository;
const repositoryMock = jest.mocked(repository);

describe('ChainsService', () => {
  const service: ChainsService = new ChainsService(repositoryMock);

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should retrieve the backbone metadata', async () => {
    const chainId = '1';
    const backbone = backboneFactory();
    repositoryMock.getBackbone.mockResolvedValueOnce(backbone);

    const actual = await service.getBackbone(chainId);

    expect(actual).toBe(backbone);
    expect(repositoryMock.getBackbone).toBeCalledTimes(1);
  });
});
