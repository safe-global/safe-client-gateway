import { encodeFunctionData, formatUnits, getAddress, parseAbi } from 'viem';
import { faker } from '@faker-js/faker';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { ILoggingService } from '@/logging/logging.interface';

import { HumanDescriptionApi } from '@/datasources/human-description-api/human-description-api.service';
import { HumanDescriptionRepository } from '@/domain/human-description/human-description.repository';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { Hex } from 'viem/types/misc';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { Token } from '@/domain/tokens/entities/token.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MAX_UINT256 } from '@/routes/transactions/constants';
import { SafeAppInfo } from '@/routes/transactions/entities/safe-app-info.entity';
import { HumanDescriptionMapper } from '@/routes/transactions/mappers/common/human-description.mapper';
import { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as jest.MockedObjectDeep<TokenRepository>);

const mockLoggingService: jest.MockedObjectDeep<ILoggingService> = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const safeAppInfoMapper = jest.mocked({
  mapSafeAppInfo: jest.fn(),
} as jest.MockedObjectDeep<SafeAppInfoMapper>);

const humanDescriptionAPI = new HumanDescriptionApi();
const humanDescriptionRepository = new HumanDescriptionRepository(
  humanDescriptionAPI,
);
const abi = parseAbi(['function transfer(address, uint256)']);

describe('Human descriptions mapper (Unit)', () => {
  let mapper: HumanDescriptionMapper;
  let mockAmount: bigint;
  let mockAddress: Hex;
  let mockTransferData: Hex;
  let toAddress: AddressInfo;
  let chainId: string;
  let token: Token;
  let transaction: MultisigTransaction;

  beforeEach(() => {
    jest.resetAllMocks();

    toAddress = new AddressInfo(faker.finance.ethereumAddress());
    chainId = faker.string.numeric();
    token = tokenBuilder()
      .with('decimals', faker.number.int({ min: 1, max: 18 }))
      .build();
    mockAmount = faker.number.bigInt();
    mockAddress = getAddress(faker.finance.ethereumAddress());
    mockTransferData = encodeFunctionData({
      abi,
      functionName: 'transfer',
      args: [mockAddress, mockAmount],
    });

    transaction = multisigTransactionBuilder()
      .with('to', toAddress.value)
      .with('data', mockTransferData)
      .build();

    mapper = new HumanDescriptionMapper(
      tokenRepository,
      mockLoggingService,
      humanDescriptionRepository,
      safeAppInfoMapper,
    );
  });

  it('should return null if there is no data', async () => {
    const transaction = multisigTransactionBuilder().with('data', null).build();

    const humanDescription = await mapper.mapRichDecodedInfo(
      transaction,
      chainId,
    );

    expect(humanDescription).toBeNull();
  });

  it('should return null if data is not hex data', async () => {
    const data = 'something that is not hex';

    const transaction = multisigTransactionBuilder().with('data', data).build();

    const humanDescription = await mapper.mapRichDecodedInfo(
      transaction,
      chainId,
    );

    expect(humanDescription).toBeNull();
  });

  it('should return a human-readable description for erc20 transfers', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const humanDescription = await mapper.mapRichDecodedInfo(
      transaction,
      chainId,
    );

    const expectedResult = [
      { type: 'text', value: 'Send' },
      {
        type: 'tokenValue',
        value: formatUnits(mockAmount, token.decimals!),
        symbol: token.symbol,
        logoUri: token.logoUri,
      },
      { type: 'text', value: 'to' },
      { type: 'address', value: mockAddress },
    ];

    expect(humanDescription).toEqual({ fragments: expectedResult });
  });

  it('should return null for corrupt data', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const corruptedData = mockTransferData.slice(0, -7);

    const transaction = multisigTransactionBuilder()
      .with('data', corruptedData)
      .build();

    const humanDescription = await mapper.mapRichDecodedInfo(
      transaction,
      chainId,
    );

    expect(humanDescription).toBeNull();
  });

  it('should return raw amount if token info cannot be fetched', async () => {
    tokenRepository.getToken.mockImplementationOnce(() => {
      return Promise.reject();
    });

    const humanDescription = await mapper.mapRichDecodedInfo(
      transaction,
      chainId,
    );

    const expectedResult = [
      { type: 'text', value: 'Send' },
      {
        type: 'tokenValue',
        value: mockAmount.toString(),
        symbol: null,
        logoUri: null,
      },
      { type: 'text', value: 'to' },
      { type: 'address', value: mockAddress },
    ];

    expect(humanDescription).toEqual({ fragments: expectedResult });
  });

  it('should return a description for unlimited token approvals', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));

    const mockAddress = getAddress(faker.finance.ethereumAddress());

    const mockApprovalData = encodeFunctionData({
      abi: parseAbi(['function approve(address, uint256)']),
      functionName: 'approve',
      args: [mockAddress, MAX_UINT256],
    });

    const transaction = multisigTransactionBuilder()
      .with('data', mockApprovalData)
      .build();

    const humanDescription = await mapper.mapRichDecodedInfo(
      transaction,
      chainId,
    );

    const expectedResult = [
      { type: 'text', value: 'Approve' },
      {
        type: 'tokenValue',
        value: 'unlimited',
        symbol: token.symbol,
        logoUri: token.logoUri,
      },
    ];

    expect(humanDescription).toEqual({ fragments: expectedResult });
  });

  it('should append the safe app name to the description if it exists', async () => {
    tokenRepository.getToken.mockImplementation(() => Promise.resolve(token));
    const mockSafeAppName = faker.word.noun();
    const mockSafeAppInfo = new SafeAppInfo(
      mockSafeAppName,
      faker.internet.url(),
      faker.image.avatar(),
    );
    safeAppInfoMapper.mapSafeAppInfo.mockImplementation(() =>
      Promise.resolve(mockSafeAppInfo),
    );

    const humanDescription = await mapper.mapRichDecodedInfo(
      transaction,
      chainId,
    );

    const expectedResult = [
      { type: 'text', value: 'Send' },
      {
        type: 'tokenValue',
        value: formatUnits(mockAmount, token.decimals!),
        symbol: token.symbol,
        logoUri: token.logoUri,
      },
      { type: 'text', value: 'to' },
      { type: 'address', value: mockAddress },
      { type: 'text', value: `via ${mockSafeAppName}` },
    ];

    expect(humanDescription).toEqual({ fragments: expectedResult });
  });
});
