import { Test, TestingModule } from '@nestjs/testing';
import { ChainsController } from './chains.controller';
import { ChainsService } from './chains.service';
import { Backbone, Chain, Page } from './entities';

describe('ChainsController (Unit)', () => {
  let chainsController: ChainsController;
  let chainsService: ChainsService;

  const chainsResponse: Page<Chain> = {
    count: 2,
    next: null,
    previous: null,
    results: [
      <Chain>{
        chainId: '1',
        chainName: 'testChain',
        vpcTransactionService: 'http://test-endpoint.local',
      },
    ],
  };

  const backboneResponse: Backbone = {
    name: 'Service Name',
    version: '4.6.1',
    api_version: 'v1',
    secure: false,
    host: 'service.host',
    headers: ['header1', 'header2'],
    settings: { key1: 'value1', key2: 'value2' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChainsController],
      providers: [
        {
          provide: ChainsService,
          useValue: {
            getChains: jest.fn().mockResolvedValue(chainsResponse),
            getBackbone: jest.fn().mockResolvedValue(backboneResponse),
          },
        },
      ],
    }).compile();

    chainsController = module.get<ChainsController>(ChainsController);
    chainsService = module.get<ChainsService>(ChainsService);
  });

  it('should get chains from service', async () => {
    expect(await chainsController.getChains()).toBe(chainsResponse);
    expect(chainsService.getChains).toHaveBeenCalledTimes(1);
  });

  it('should get backbone for an specific chain', async () => {
    expect(await chainsController.getBackbone('1')).toBe(backboneResponse);
    expect(chainsService.getBackbone).toHaveBeenCalledTimes(1);
  });
});
