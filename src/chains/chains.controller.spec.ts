import { Test, TestingModule } from '@nestjs/testing';
import { Chain } from './entities/chain.entity';
import { Page } from './entities/page.entity';
import { ChainsController } from './chains.controller';
import { ChainsService } from './chains.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChainsController],
      providers: [
        {
          provide: ChainsService,
          useValue: {
            getChains: jest.fn().mockResolvedValue(chainsResponse),
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
    throw new Error('unimplemented');
  });
});
