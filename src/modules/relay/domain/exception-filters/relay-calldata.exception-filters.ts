// SPDX-License-Identifier: FSL-1.1-MIT
import { applyDecorators, UseFilters } from '@nestjs/common';
import { InvalidMultiSendExceptionFilter } from '@/modules/relay/domain/exception-filters/invalid-multisend.exception-filter';
import { InvalidTransferExceptionFilter } from '@/modules/relay/domain/exception-filters/invalid-transfer.exception-filter';
import { RelayDeniedExceptionFilter } from '@/modules/relay/domain/exception-filters/relay-denied.exception-filter';
import { RelayerNotAvailableExceptionFilter } from '@/modules/relay/domain/exception-filters/relayer-not-available.exception-filter';
import { UnofficialMasterCopyExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-master-copy.exception-filter';
import { UnofficialMultiSendExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-multisend.error';
import { UnofficialProxyFactoryExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-proxy-factory.exception-filter';
import { UnofficialSignerFactoryExceptionFilter } from '@/modules/relay/domain/exception-filters/unofficial-signer-factory.exception-filter';

/**
 * Exception filters shared by every relay endpoint (`RelayController` and
 * `SpaceRelayController`). They map the errors thrown while the relay service
 * validates the calldata to HTTP responses:
 *
 * - the relayer refused the request or is unavailable,
 * - the calldata is not a recognised Safe transaction (multiSend, transfer),
 * - the calldata targets a contract that is not an official Safe deployment
 *   (master copy, MultiSend, ProxyFactory, signer factory).
 *
 * Errors specific to one endpoint (e.g. rate limits or space quotas) are not
 * included here; each controller adds those with its own `@UseFilters`.
 */
export const RelayCalldataExceptionFilters = (): MethodDecorator &
  ClassDecorator =>
  applyDecorators(
    UseFilters(
      RelayDeniedExceptionFilter,
      RelayerNotAvailableExceptionFilter,
      InvalidMultiSendExceptionFilter,
      InvalidTransferExceptionFilter,
      UnofficialMasterCopyExceptionFilter,
      UnofficialMultiSendExceptionFilter,
      UnofficialProxyFactoryExceptionFilter,
      UnofficialSignerFactoryExceptionFilter,
    ),
  );
