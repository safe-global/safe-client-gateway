import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import configuration from '@/config/entities/__tests__/configuration';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { INestApplication, Inject, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'net';
import {
  IQueuesRepository,
  QueuesRepositoryModule,
} from '@/domain/queues/queues-repository.interface';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';

class TestQueueService {
  constructor(
    @Inject(IQueuesRepository)
    private readonly queuesRepository: IQueuesRepository,
  ) {}

  onModuleInit(): void {
    this.queuesRepository.onEvent(this.onEvent);
  }

  onEvent(): Promise<void> {
    return Promise.resolve();
  }
}

@Module({
  imports: [QueuesRepositoryModule],
  providers: [TestQueueService],
})
export class TestQueueModule {}

describe('QueuesRepository', () => {
  let app: INestApplication<Server>;
  let queuesApi: IQueuesApiService;
  const cacheKeyPrefix = crypto.randomUUID();
  const queue = crypto.randomUUID();

  beforeAll(async () => {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      amqp: {
        ...defaultConfiguration.amqp,
        queue,
      },
      features: {
        ...defaultConfiguration.features,
        eventsQueue: true,
      },
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [
        AppModule.register(testConfiguration),
        // Second module to subscribe to queue
        TestQueueModule,
      ],
    })
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideProvider(CacheKeyPrefix)
      .useValue(cacheKeyPrefix)
      .compile();

    queuesApi = moduleFixture.get<IQueuesApiService>(IQueuesApiService);
    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should not subscribe the same queue multiple if in multiple places', () => {
    expect(app.get(CacheHooksService)).toBeDefined();
    // TODO: Replace with notification hook service
    expect(app.get(TestQueueService)).toBeDefined();

    expect(queuesApi.subscribe).toHaveBeenCalledTimes(1);
    expect(queuesApi.subscribe).toHaveBeenCalledWith(
      queue,
      expect.any(Function),
    );
  });
});
