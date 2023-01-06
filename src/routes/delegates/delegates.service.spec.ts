import { DelegatesService } from './delegates.service';
import { Delegate } from './entities/delegate.entity';
import { IDelegateRepository } from '../../domain/delegate/delegate.repository.interface';
import { faker } from '@faker-js/faker';
import { Page } from '../common/entities/page.entity';
import { DelegateParamsDto } from './entities/delegate-params.entity';
import { PaginationData } from '../common/pagination/pagination.data';
import { delegateBuilder } from '../../domain/delegate/entities/__tests__/delegate.builder';

const delegateRepository = {
  getDelegates: jest.fn(),
} as unknown as IDelegateRepository;

const delegateRepositoryMock = jest.mocked(delegateRepository);

describe('DelegatesService', () => {
  const service: DelegatesService = new DelegatesService(
    delegateRepositoryMock,
  );

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  it('should retrieve the delegates from a safe', async () => {
    const chainId = '1';
    const safe = faker.finance.ethereumAddress();
    const url = faker.internet.url();
    const routeUrl: Readonly<URL> = new URL(url);
    const paginationData = PaginationData.fromCursor(routeUrl);
    const delegates = <Page<Delegate>>{
      count: 2,
      next: null,
      previous: null,
      results: [
        delegateBuilder().with('safe', safe).build(),
        delegateBuilder().with('safe', safe).build(),
      ],
    };
    delegateRepositoryMock.getDelegates.mockResolvedValueOnce(delegates);

    const params = new DelegateParamsDto(safe);
    const actual = await service.getDelegates(
      chainId,
      routeUrl,
      params,
      paginationData,
    );

    expect(actual).toEqual(delegates);
    expect(delegateRepositoryMock.getDelegates).toBeCalledTimes(1);
  });
});
