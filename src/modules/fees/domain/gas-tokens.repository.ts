// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import differenceBy from 'lodash/differenceBy';
import type { Page } from '@/domain/entities/page.entity';
import { LenientBasePageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { GasToken } from '@/modules/fees/domain/entities/gas-token.entity';
import { GasTokenLenientPageSchema } from '@/modules/fees/domain/entities/schemas/gas-token.schema';
import type { IGasTokensRepository } from '@/modules/fees/domain/gas-tokens.repository.interface';

@Injectable()
export class GasTokensRepository implements IGasTokensRepository {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
  ) {}

  async getGasTokens(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): Promise<Page<GasToken>> {
    const page = await this.configApi
      .getGasTokens(args.chainId, { limit: args.limit, offset: args.offset })
      .then(LenientBasePageSchema.parse);
    const valid = GasTokenLenientPageSchema.parse(page);
    if (valid.results.length < page.results.length) {
      this.loggingService.error({
        message: 'Some gas tokens could not be parsed',
        errors: differenceBy(page.results, valid.results, 'address'),
      });
    }
    return valid;
  }
}
