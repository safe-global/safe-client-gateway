import { Test, TestingModule } from '@nestjs/testing';
import { NetworkModule } from './network.module';

describe('NetworkModule', () => {
  it(`NetworkModule is successfully created`, async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NetworkModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    await app.close();
  });
});
