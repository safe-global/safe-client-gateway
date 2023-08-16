import { faker } from '@faker-js/faker';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { HumanDescriptionsMapper } from './human-descriptions.mapper';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { tokenBuilder } from '../../../../domain/tokens/__tests__/token.builder';
import { ILoggingService } from '../../../../logging/logging.interface';

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as unknown as TokenRepository);

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

describe('Human descriptions mapper (Unit)', () => {
  let mapper: HumanDescriptionsMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new HumanDescriptionsMapper(tokenRepository, mockLoggingService);
  });

  it('should return undefined if there is no data', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const data = faker.string.hexadecimal();

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      data,
      chainId,
      null,
    );

    expect(humanDescription).toBeUndefined();
  });

  it('should return undefined if data is not hex data', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const data = 'something that is not hex';

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      data,
      chainId,
      null,
    );

    expect(humanDescription).toBeUndefined();
  });

  it('should return a human-readable description for erc20 transfers', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const token = tokenBuilder()
      .with('decimals', 18)
      .with('name', 'Test Token')
      .with('symbol', 'TST')
      .build();
    tokenRepository.getToken.mockResolvedValue(token);
    const data =
      '0xa9059cbb0000000000000000000000007a9af6ef9197041a5841e84cb27873bebd3486e2000000000000000000000000000000000000000000000001236efcbcbb340000';

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      data,
      chainId,
      null,
    );

    expect(humanDescription).toBe('Send 21 TST to 0x7a9a...86E2');
  });

  it('should return undefined for corrupt data', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const token = tokenBuilder()
      .with('decimals', 18)
      .with('name', 'Test Token')
      .with('symbol', 'TST')
      .build();
    tokenRepository.getToken.mockResolvedValue(token);
    const data =
      '0xa9059cbb0000000000000000000000007a9af6ef9197041a5841e84cb27873bebd3486e2000000000000000000000000000000000000000000000001236efcbcb';

    const humanDescription = await mapper.mapHumanDescription(
      toAddress.value,
      data,
      chainId,
      null,
    );

    expect(humanDescription).toBeUndefined();
  });
});
