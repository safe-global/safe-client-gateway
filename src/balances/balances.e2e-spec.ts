import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { BalancesModule } from './balances.module';
import axios from 'axios';

jest.mock('axios');

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [BalancesModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it(`GET /balances`, async () => {
    const chainId = 1;
    const safeAddress = '0x00000';
    const balance = {};
    // axios.get.mockResolvedValueOnce(balance);

    return request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/balances`)
      .expect(200)
      .expect('Hello World!');
  });
});
