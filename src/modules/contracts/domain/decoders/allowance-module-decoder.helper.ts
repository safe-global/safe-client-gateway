// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { getAllowanceModuleAbi } from '@/domain/common/utils/deployments';
import { AbiDecoder } from '@/modules/contracts/domain/decoders/abi-decoder.helper';

@Injectable()
export class AllowanceModuleDecoder extends AbiDecoder<
  ReturnType<typeof getAllowanceModuleAbi>
> {
  constructor() {
    super(getAllowanceModuleAbi());
  }
}
