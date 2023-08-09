import { faker } from '@faker-js/faker';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { ReadableDescriptionsMapper } from './readable-descriptions.mapper';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { tokenBuilder } from '../../../../domain/tokens/__tests__/token.builder';

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as unknown as TokenRepository);

describe('Readable descriptions mapper (Unit)', () => {
  let mapper: ReadableDescriptionsMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new ReadableDescriptionsMapper(tokenRepository);
  });

  it('should return null if there is no data', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const data = faker.string.hexadecimal();

    const readableDescription = await mapper.mapReadableDescription(
      toAddress.value,
      data,
      chainId,
    );

    expect(readableDescription).toBeNull();
  });

  it('should return null if data is not hex data', async () => {
    const toAddress = new AddressInfo(faker.finance.ethereumAddress());
    const chainId = faker.string.numeric();
    const data = 'something that is not hex';

    const readableDescription = await mapper.mapReadableDescription(
      toAddress.value,
      data,
      chainId,
    );

    expect(readableDescription).toBeNull();
  });

  it('should return a readable description for erc20 transfers', async () => {
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

    const readableDescription = await mapper.mapReadableDescription(
      toAddress.value,
      data,
      chainId,
    );

    expect(readableDescription).toBe(
      'Send 21 TST to 0x7a9af6Ef9197041A5841e84cB27873bEBd3486E2',
    );
  });
});
