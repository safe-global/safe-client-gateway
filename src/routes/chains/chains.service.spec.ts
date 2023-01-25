import { FakeConfigurationService } from '../../config/__tests__/fake.configuration.service';
import { IBackboneRepository } from '../../domain/backbone/backbone.repository.interface';
import { backboneBuilder } from '../../domain/backbone/entities/__tests__/backbone.builder';
import { IChainsRepository } from '../../domain/chains/chains.repository.interface';
import { masterCopyBuilder } from '../../domain/chains/entities/__tests__/master-copy.builder';
import { ChainsService } from './chains.service';
import { MasterCopy } from './entities/master-copy.entity';

const chainsRepository = {
  getChains: jest.fn(),
  getMasterCopies: jest.fn(),
} as unknown as IChainsRepository;

const chainsRepositoryMock = jest.mocked(chainsRepository);

const backboneRepository = {
  getBackbone: jest.fn(),
} as unknown as IBackboneRepository;

const backboneRepositoryMock = jest.mocked(backboneRepository);

describe('ChainsService', () => {
  const service: ChainsService = new ChainsService(
    new FakeConfigurationService(),
    chainsRepositoryMock,
    backboneRepositoryMock,
  );

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should retrieve the backbone metadata', async () => {
    const chainId = '1';
    const backbone = backboneBuilder().build();
    backboneRepositoryMock.getBackbone.mockResolvedValueOnce(backbone);

    const actual = await service.getBackbone(chainId);

    expect(actual).toBe(backbone);
    expect(backboneRepositoryMock.getBackbone).toBeCalledTimes(1);
  });

  it('should retrieve the mastercopies', async () => {
    const chainId = '1';
    const masterCopies = [
      masterCopyBuilder().build(),
      masterCopyBuilder().build(),
    ];
    chainsRepositoryMock.getMasterCopies.mockResolvedValueOnce(masterCopies);
    const expected = masterCopies.map(
      (masterCopy) =>
        <MasterCopy>{
          address: masterCopy.address,
          version: masterCopy.version,
        },
    );

    const actual = await service.getMasterCopies(chainId);

    expect(actual).toStrictEqual(expected);
    expect(chainsRepositoryMock.getMasterCopies).toBeCalledTimes(1);
  });
});
