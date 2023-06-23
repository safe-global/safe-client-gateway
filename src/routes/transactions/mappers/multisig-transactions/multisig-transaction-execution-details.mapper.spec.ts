import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { SafeRepository } from '../../../../domain/safe/safe.repository';
import { TokenRepository } from '../../../../domain/tokens/token.repository';
import { ILoggingService } from '../../../../logging/logging.interface';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { MultisigTransactionExecutionDetailsMapper } from './multisig-transaction-execution-details.mapper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as unknown as AddressInfoHelper);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as unknown as TokenRepository);

const safeRepository = jest.mocked({
  getMultisigTransactions: jest.fn(),
} as unknown as SafeRepository);

const loggingService = jest.mocked({
  debug: jest.fn(),
} as unknown as ILoggingService);

describe.skip('MultisigTransactionExecutionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionExecutionDetailsMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new MultisigTransactionExecutionDetailsMapper(
      addressInfoHelper,
      tokenRepository,
      safeRepository,
      loggingService,
    );
  });

  it('should return a MultisigExecutionDetails object', async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const safe = safeBuilder().build();
    await mapper.mapMultisigExecutionDetails(chainId, transaction, safe);
  });
});
