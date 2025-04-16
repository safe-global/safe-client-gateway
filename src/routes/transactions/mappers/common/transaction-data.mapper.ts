import { Inject, Injectable } from '@nestjs/common';
import isEmpty from 'lodash/isEmpty';
import { ContractsRepository } from '@/domain/contracts/contracts.repository';
import { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Operation } from '@/domain/safe/entities/operation.entity';
import {
  BaseDataDecoded,
  DataDecoded,
  DataDecodedParameter,
} from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import {
  MULTI_SEND_METHOD_NAME,
  TRANSACTIONS_PARAMETER_NAME,
  ADDRESS_PARAMETER_TYPE,
} from '@/routes/transactions/constants';
import { PreviewTransactionDto } from '@/routes/transactions/entities/preview-transaction.dto.entity';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { getAddress } from 'viem';
import {
  Erc20Token,
  Erc721Token,
  NativeToken,
} from '@/domain/tokens/entities/token.entity';
import { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { ITokenRepository } from '@/domain/tokens/token.repository.interface';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class TransactionDataMapper {
  private readonly maxTokenInfoIndexSize: number;

  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(IContractsRepository)
    private readonly contractRepository: ContractsRepository,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.maxTokenInfoIndexSize = this.configurationService.getOrThrow<number>(
      'mappings.transactionData.maxTokenInfoIndexSize',
    );
  }

  async mapTransactionData(
    chainId: string,
    previewTransactionDto: PreviewTransactionDto,
    dataDecoded: DataDecoded | null,
    safeAddress: `0x${string}`,
  ): Promise<TransactionData> {
    const [toAddress, isTrustedDelegateCall, addressInfoIndex] =
      await Promise.all([
        this.addressInfoHelper.getOrDefault(chainId, previewTransactionDto.to, [
          'CONTRACT',
        ]),
        this.isTrustedDelegateCall(
          chainId,
          previewTransactionDto.operation,
          previewTransactionDto.to,
          dataDecoded,
        ),
        this.buildAddressInfoIndex(chainId, dataDecoded),
      ]);

    // We call this after as addressInfoIndex may warm the cache of some tokens
    const tokenInfoIndex = await this.buildTokenInfoIndex({
      chainId,
      safeAddress,
      dataDecoded,
    });

    return new TransactionData(
      previewTransactionDto.data,
      dataDecoded,
      toAddress,
      previewTransactionDto.value,
      previewTransactionDto.operation,
      isTrustedDelegateCall ?? null,
      isEmpty(addressInfoIndex) ? null : addressInfoIndex,
      isEmpty(tokenInfoIndex) ? null : tokenInfoIndex,
    );
  }

  /**
   * Determines if the transaction is a trusted DELEGATE call.
   * @param chainId chain id
   * @param operation transaction operation
   * @param to transaction target address
   * @param dataDecoded data decoded to check
   * @returns null if the transaction operation is not DELEGATE.
   * If the transaction operation is DELEGATE, and the target {@link Contract}
   * is trusted, and the {@link DataDecoded} received does not contain
   * a nested DELEGATE operation, then true is returned.
   * Otherwise, the function will return false.
   */
  async isTrustedDelegateCall(
    chainId: string,
    operation: Operation,
    to: `0x${string}`,
    dataDecoded: DataDecoded | null,
  ): Promise<boolean | null> {
    if (operation !== Operation.DELEGATE) return null;

    let isTrustedForDelegateCall: boolean;
    try {
      isTrustedForDelegateCall =
        await this.contractRepository.isTrustedForDelegateCall({
          chainId,
          contractAddress: to,
        });
    } catch {
      return false;
    }

    const hasNestedDelegate = dataDecoded
      ? this.dataDecodedParamHelper.hasNestedDelegate(dataDecoded)
      : false;

    return isTrustedForDelegateCall && !hasNestedDelegate;
  }

  /**
   * Builds a {@link Record<string, TokenInfo>} which contains all the tokens
   * extracted from {@link DataDecoded} as keys, and their related {@link TokenInfo}
   * as value.
   * @param args.chainId - chain ID to use
   * @param args.safeAddress - Safe address to use
   * @param args.dataDecoded - decoded data to traverse
   * @returns {@link Record<string, TokenInfo>} - hashmap of tokens <> their info.
   */
  async buildTokenInfoIndex(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    dataDecoded: BaseDataDecoded | null;
  }): Promise<Record<`0x${string}`, Erc20Token | Erc721Token | NativeToken>> {
    if (
      !args.dataDecoded?.parameters ||
      args.dataDecoded.method !== MULTI_SEND_METHOD_NAME
    ) {
      return {};
    }

    const tokenAddresses = this._getBatchTransferredTokenAddresses({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      parameters: args.dataDecoded.parameters,
    });

    const tokenInfos = await this._getTokenInfos({
      tokenAddresses,
      chainId: args.chainId,
    });

    return Object.fromEntries(
      tokenInfos.map((token) => [token.address, token]),
    );
  }

  /**
   * Extracts the addresses of the tokens transferred in a batch from the given
   * {@link DataDecodedParameter} array.
   * @param args.chainId - chain ID to use
   * @param args.safeAddress - Safe address to use
   * @param args.parameters - array of {@link DataDecodedParameter}
   * @returns {@link Array<`0x${string}`>} - array of token addresses
   */
  private _getBatchTransferredTokenAddresses(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    parameters: Array<DataDecodedParameter>;
  }): Array<`0x${string}`> {
    const tokens = new Set<`0x${string}`>();

    for (const parameter of args.parameters) {
      const isMultiSend =
        parameter.name === TRANSACTIONS_PARAMETER_NAME &&
        parameter.type === 'bytes';

      if (!isMultiSend || !Array.isArray(parameter.valueDecoded)) {
        continue;
      }

      for (const batchedTransaction of parameter.valueDecoded) {
        const isNativeCoin = batchedTransaction.value !== '0';

        if (isNativeCoin) {
          tokens.add(NULL_ADDRESS);
          continue;
        }

        const isValidTokenTransfer =
          this.transactionInfoMapper.isValidTokenTransfer(
            args.safeAddress,
            batchedTransaction.dataDecoded,
          );

        if (isValidTokenTransfer) {
          tokens.add(batchedTransaction.to);
        }
      }
    }

    return Array.from(tokens);
  }

  /**
   * Gets the token info for the passed token addresses.
   * @param args.tokenAddresses - array of token addresses
   * @param args.chainId - chain ID to use
   * @returns {@link Array<TokenInfo>} - array of token info
   */
  private async _getTokenInfos(args: {
    tokenAddresses: Array<`0x${string}`>;
    chainId: string;
  }): Promise<Array<Erc20Token | Erc721Token | NativeToken>> {
    const tokenAddresses = args.tokenAddresses.slice(
      0,
      this.maxTokenInfoIndexSize,
    );
    return (
      await Promise.allSettled(
        tokenAddresses.map(async (tokenAddress) => {
          const isNativeCoin = tokenAddress === NULL_ADDRESS;
          if (isNativeCoin) {
            const { nativeCurrency } = await this.chainsRepository.getChain(
              args.chainId,
            );
            return {
              type: 'NATIVE_TOKEN' as const,
              address: NULL_ADDRESS as `0x${string}`,
              decimals: nativeCurrency.decimals,
              logoUri: nativeCurrency.logoUri,
              name: nativeCurrency.name,
              symbol: nativeCurrency.symbol,
              trusted: true,
            };
          } else {
            return await this.tokenRepository.getToken({
              chainId: args.chainId,
              address: tokenAddress,
            });
          }
        }),
      )
    )
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
  }

  /**
   * Builds a {@link Record<string, AddressInfo>} which contains all the addresses
   * extracted from {@link DataDecoded} as keys, and their related {@link AddressInfo}
   * as value.
   * @param chainId - chain id to use
   * @param dataDecoded data decoded to use
   * @returns {@link Record<string, AddressInfo>}
   */
  async buildAddressInfoIndex(
    chainId: string,
    dataDecoded: DataDecoded | null,
  ): Promise<Record<string, AddressInfo>> {
    if (dataDecoded === null || !Array.isArray(dataDecoded.parameters))
      return {};
    const { method, parameters } = dataDecoded;
    const promises: Array<
      Promise<Array<AddressInfo | null> | AddressInfo | null>
    > = [];

    for (const parameter of parameters) {
      if (
        method === MULTI_SEND_METHOD_NAME &&
        parameter.name === TRANSACTIONS_PARAMETER_NAME &&
        parameter.valueDecoded
      ) {
        promises.push(
          this._getFromValueDecoded(chainId, parameter.valueDecoded),
        );
      } else if (parameter.type === ADDRESS_PARAMETER_TYPE) {
        promises.push(this._getIfValid(chainId, parameter.value));
      }
    }

    const addressInfos = (await Promise.all(promises))
      .flat()
      .filter((i): i is AddressInfo => i !== null);

    return Object.fromEntries(addressInfos.map((i) => [i.value, i]));
  }

  /**
   * Gets an array of {@link AddressInfo} for the passed valueDecoded, by iterating
   * through its operations. For each operation, both its 'to' address and the addresses
   * contained in its dataDecoded parameters are collected.
   *
   * Null values are added to the result array for each invalid value encountered.
   * @param chainId - chain id to use
   * @param valueDecoded - valueDecoded to use
   */
  private async _getFromValueDecoded(
    chainId: string,
    valueDecoded: unknown,
  ): Promise<Array<AddressInfo | null>> {
    if (!Array.isArray(valueDecoded)) return [];
    const promises: Array<Promise<AddressInfo | null>> = [];

    for (const transaction of valueDecoded) {
      promises.push(this._getIfValid(chainId, transaction.to));
      if (transaction?.dataDecoded?.parameters) {
        for (const param of transaction.dataDecoded.parameters) {
          if (param.type === ADDRESS_PARAMETER_TYPE) {
            promises.push(this._getIfValid(chainId, param.value));
          }
        }
      }
    }
    return Promise.all(promises);
  }

  /**
   * Gets an {@link AddressInfo} for the passed value, if it is valid.
   * @param chainId - chain id to use
   * @param value - value to use
   */
  private async _getIfValid(
    chainId: string,
    value: unknown,
  ): Promise<AddressInfo | null> {
    if (typeof value === 'string' && value !== NULL_ADDRESS) {
      const addressInfo = await this.addressInfoHelper
        .get(chainId, getAddress(value), ['TOKEN', 'CONTRACT'])
        .catch(() => null);
      return addressInfo?.name ? addressInfo : null;
    }
    return null;
  }
}
