// SPDX-License-Identifier: FSL-1.1-MIT
import type { CounterfactualSafe } from '@/modules/counterfactual-safes/datasources/entities/counterfactual-safe.entity.db';
import type {
  GetCounterfactualSafeItem,
  GetCounterfactualSafesResponse,
} from '@/modules/counterfactual-safes/routes/entities/get-counterfactual-safe.dto.entity';
import { groupBy, mapValues } from 'lodash';

export function transformCounterfactualSafesResponse(
  counterfactualSafes: Array<CounterfactualSafe>,
): GetCounterfactualSafesResponse['safes'] {
  const grouped = groupBy(counterfactualSafes, 'chainId');

  return mapValues(grouped, (items) =>
    items.map(
      (item): GetCounterfactualSafeItem => ({
        address: item.address,
        factoryAddress: item.factoryAddress,
        masterCopy: item.masterCopy,
        saltNonce: item.saltNonce,
        safeVersion: item.safeVersion,
        threshold: item.threshold,
        owners: item.owners,
        fallbackHandler: item.fallbackHandler,
        to: item.setupTo,
        data: item.setupData,
        paymentToken: item.paymentToken,
        payment: item.payment,
        paymentReceiver: item.paymentReceiver,
      }),
    ),
  );
}
