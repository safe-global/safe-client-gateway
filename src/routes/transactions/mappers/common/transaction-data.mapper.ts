import { Inject, Injectable } from '@nestjs/common';
import { isArray, isNull } from 'lodash';
import { ContractsRepository } from '../../../../domain/contracts/contracts.repository';
import { IContractsRepository } from '../../../../domain/contracts/contracts.repository.interface';
import { Operation } from '../../../../domain/safe/entities/operation.entity';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import {
  ADDRESS_PARAMETER_TYPE,
  MULTI_SEND_METHOD_NAME,
  NULL_ADDRESS,
  TRANSACTIONS_PARAMETER_NAME,
} from '../../../common/constants';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { isHex } from '../../../common/utils/utils';
import { Contract } from '../../../contracts/entities/contract.entity';
import { DataDecodedParameter } from '../../../data-decode/entities/data-decoded-parameter.entity';
import { DataDecoded } from '../../../data-decode/entities/data-decoded.entity';
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
    dataDecoded: DataDecoded,
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
      addressInfoIndex,
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
    dataDecoded: DataDecoded,
  ): Promise<boolean | null> {
    if (operation !== 1) return null;
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
   * @param chainId chain id
   * @param dataDecoded data decoded to use
   * @returns {@link Record<string, AddressInfo>}
   */
  async buildAddressInfoIndex(
    chainId: string,
    dataDecoded: DataDecoded,
  ): Promise<Record<string, AddressInfo>> {
    if (!isArray(dataDecoded.parameters)) return {};

    const addressInfos = await Promise.all(
      this.getAddressParametersFromDataDecoded(dataDecoded).map((param) =>
        this.getIfValidAddress(chainId, param),
      ),
    );

    return addressInfos
      .filter((addressInfo) => !isNull(addressInfo))
      .reduce(
        (addressInfoIndex, addressInfo) =>
          addressInfo
            ? { ...addressInfoIndex, [addressInfo.value]: addressInfo }
            : addressInfoIndex,
        {},
      );
  }

  private getAddressParametersFromDataDecoded({
    parameters,
    method,
  }: DataDecoded): DataDecodedParameter[] {
    if (!isArray(parameters)) return [];
    return method === MULTI_SEND_METHOD_NAME
      ? this.getAddressParametersFromMultiSend(parameters)
      : parameters.filter((p) => p.type === ADDRESS_PARAMETER_TYPE);
  }

  private getAddressParametersFromMultiSend(
    parameters: DataDecodedParameter[] | null,
  ): DataDecodedParameter[] {
    if (!isArray(parameters)) return [];
    return parameters
      .filter((p) => p.name === TRANSACTIONS_PARAMETER_NAME)
      .flatMap((p) =>
        this.getAddressParametersFromValueDecoded(p.valueDecoded),
      );
  }

  private getAddressParametersFromValueDecoded(
    valueDecoded: unknown,
  ): DataDecodedParameter[] {
    if (!isArray(valueDecoded)) return [];
    return valueDecoded.flatMap((operation) =>
      this.getAddressParametersFromDataDecoded(operation.dataDecoded),
    );
  }

  private async getIfValidAddress(
    chainId: string,
    { value }: DataDecodedParameter,
  ): Promise<AddressInfo | null> {
    return typeof value === 'string' &&
      value.length == 42 &&
      isHex(value) &&
      value !== NULL_ADDRESS
      ? this.addressInfoHelper.getOrDefault(chainId, value)
      : null;
  }
}
