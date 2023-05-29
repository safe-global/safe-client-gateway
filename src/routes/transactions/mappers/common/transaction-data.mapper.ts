import { Inject, Injectable } from '@nestjs/common';
import { isArray, isEmpty } from 'lodash';
import { ContractsRepository } from '../../../../domain/contracts/contracts.repository';
import { IContractsRepository } from '../../../../domain/contracts/contracts.repository.interface';
import {
  DELEGATE_OPERATION,
  Operation,
} from '../../../../domain/safe/entities/operation.entity';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { NULL_ADDRESS } from '../../../common/constants';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { isHex } from '../../../common/utils/utils';
import { Contract } from '../../../contracts/entities/contract.entity';
import { DataDecoded } from '../../../data-decode/entities/data-decoded.entity';
import {
  ADDRESS_PARAMETER_TYPE,
  MULTI_SEND_METHOD_NAME,
  TRANSACTIONS_PARAMETER_NAME,
} from '../../constants';
import { PreviewTransactionDto } from '../../entities/preview-transaction.dto.entity';
import { TransactionData } from '../../entities/transaction-data.entity';
import { DataDecodedParamHelper } from './data-decoded-param.helper';

@Injectable()
export class TransactionDataMapper {
  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    @Inject(IContractsRepository)
    private readonly contractRepository: ContractsRepository,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
  ) {}

  async mapTransactionData(
    chainId: string,
    previewTransactionDto: PreviewTransactionDto,
    dataDecoded: DataDecoded | null,
  ): Promise<TransactionData> {
    const toAddress = await this.addressInfoHelper.getOrDefault(
      chainId,
      previewTransactionDto.to,
    );
    const isTrustedDelegateCall = await this.isTrustedDelegateCall(
      chainId,
      previewTransactionDto.operation,
      previewTransactionDto.to,
      dataDecoded,
    );
    const addressInfoIndex = await this.buildAddressInfoIndex(
      chainId,
      dataDecoded,
    );

    return new TransactionData(
      previewTransactionDto.data,
      dataDecoded,
      toAddress,
      previewTransactionDto.value,
      previewTransactionDto.operation,
      isTrustedDelegateCall ?? null,
      isEmpty(addressInfoIndex) ? null : addressInfoIndex,
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
   * is trusted, and the {@link DataDecoded} received contains a nested
   * DELEGATE operation, then true is returned.
   * Otherwise the function will return false.
   */
  async isTrustedDelegateCall(
    chainId: string,
    operation: Operation,
    to: string,
    dataDecoded: DataDecoded | null,
  ): Promise<boolean | null> {
    if (dataDecoded === null || operation !== DELEGATE_OPERATION) return null;

    let contract: Contract;
    try {
      contract = await this.contractRepository.getContract(chainId, to);
    } catch (err) {
      return false;
    }

    return (
      contract.trustedForDelegateCall &&
      this.dataDecodedParamHelper.hasNestedDelegate(dataDecoded)
    );
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
    if (dataDecoded === null || !isArray(dataDecoded.parameters)) return {};
    const { method, parameters } = dataDecoded;
    const promises: Promise<(AddressInfo | null)[] | AddressInfo | null>[] = [];

    if (method === MULTI_SEND_METHOD_NAME) {
      for (const parameter of parameters) {
        const { name, valueDecoded } = parameter;
        if (name === TRANSACTIONS_PARAMETER_NAME && valueDecoded) {
          promises.push(this._getFromValueDecoded(chainId, valueDecoded));
        }
      }
    } else {
      for (const parameter of parameters) {
        if (parameter.type === ADDRESS_PARAMETER_TYPE) {
          promises.push(this._getIfValid(chainId, parameter.value));
        }
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
  ): Promise<(AddressInfo | null)[]> {
    if (!isArray(valueDecoded)) return [];
    const promises: Promise<AddressInfo | null>[] = [];

    for (const operation of valueDecoded) {
      if (operation.to) {
        promises.push(this._getIfValid(chainId, operation.to));
      }
      if (operation?.dataDecoded?.parameters) {
        for (const param of operation?.dataDecoded?.parameters) {
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
    if (
      typeof value === 'string' &&
      value.length == 42 &&
      isHex(value) &&
      value !== NULL_ADDRESS
    ) {
      const addressInfo = await this.addressInfoHelper
        .get(chainId, value, 'TOKEN')
        .catch(() => this.addressInfoHelper.get(chainId, value, 'CONTRACT'))
        .catch(() => null);
      return addressInfo?.name ? addressInfo : null;
    }
    return null;
  }
}
