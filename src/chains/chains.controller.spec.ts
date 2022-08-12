import axios from 'axios';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ChainsModule } from './chains.module';
import { Chain } from './entities/chain.entity';
import { Page } from './entities/page.entity';

jest.mock('axios');
const axiosMock = axios as jest.Mocked<typeof axios>;

describe('ChainsController (Unit)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ChainsModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('/GET chains', async () => {
    const safeConfigServiceResponse: Page<Chain> = {
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

    axiosMock.get = jest
      .fn()
      .mockResolvedValue({ data: safeConfigServiceResponse });

    await request(app.getHttpServer())
      .get('/chains')
      .expect(200)
      .expect(safeConfigServiceResponse);
  });
});
