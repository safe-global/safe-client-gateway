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
 * What any route that relays rejects: calldata we cannot recognise, and
 * deployments that are not official. Each route adds the filters for what only
 * it can refuse, which is why those stay on the handler.
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
