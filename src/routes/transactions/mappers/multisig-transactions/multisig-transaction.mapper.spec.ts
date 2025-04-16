import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import type { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import type { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import type { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import type { MultisigTransactionExecutionInfoMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import type { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction.mapper';

describe('MultisigTransactionMapper', () => {
  let mapper: MultisigTransactionMapper;

  const addressInfoHelper = jest.mocked({
    getCollection: jest.fn(),
  } as jest.MockedObjectDeep<AddressInfoHelper>);

  beforeEach(() => {
    mapper = new MultisigTransactionMapper(
      jest.mocked({} as jest.Mocked<MultisigTransactionStatusMapper>),
      jest.mocked({} as jest.Mocked<MultisigTransactionInfoMapper>),
      jest.mocked({} as jest.Mocked<MultisigTransactionExecutionInfoMapper>),
      jest.mocked({} as jest.Mocked<SafeAppInfoMapper>),
      jest.mocked({} as jest.Mocked<TransactionVerifierHelper>),
      addressInfoHelper,
      new DataDecodedParamHelper(),
    );
  });

  describe('prefetchAddressInfos', () => {
    it('should call addressInfoHelper.getCollection with the correct parameters', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const tokens = [tokenBuilder().build(), tokenBuilder().build()];
      const contracts = [contractBuilder().build(), contractBuilder().build()];
      const transactions = [
        multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('to', tokens[0].address)
          .with(
            'dataDecoded',
            dataDecodedBuilder()
              .with('method', 'transferFrom')
              .with('parameters', [
                dataDecodedParameterBuilder()
                  .with('name', 'from')
                  .with('value', contracts[0].address)
                  .build(),
                dataDecodedParameterBuilder()
                  .with('name', 'to')
                  .with('value', contracts[1].address)
                  .build(),
              ])
              .build(),
          )
          .build(),
        multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('to', tokens[1].address)
          .with(
            'dataDecoded',
            dataDecodedBuilder()
              .with('method', 'transfer')
              .with('parameters', [
                dataDecodedParameterBuilder()
                  .with('name', 'to')
                  .with('value', tokens[0].address)
                  .build(),
              ])
              .build(),
          )
          .build(),
        multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('to', tokens[1].address)
          .with(
            'dataDecoded',
            dataDecodedBuilder()
              .with('method', 'transfer')
              .with('parameters', [
                dataDecodedParameterBuilder()
                  .with('name', 'to')
                  .with('value', tokens[0].address)
                  .build(),
              ])
              .build(),
          )
          .build(),
      ];
      await mapper.prefetchAddressInfos({
        chainId: chain.chainId,
        transactions,
      });

      // Check that the addressInfoHelper.getCollection was called with deduplicated addresses
      expect(addressInfoHelper.getCollection).toHaveBeenCalledWith(
        chain.chainId,
        expect.arrayContaining([
          safe.address,
          tokens[0].address,
          tokens[1].address,
          contracts[0].address,
          contracts[1].address,
        ]),
        ['TOKEN', 'CONTRACT'],
      );
    });
  });
});
