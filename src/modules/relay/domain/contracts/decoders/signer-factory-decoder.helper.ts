// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { AbiDecoder } from '@/modules/contracts/domain/decoders/abi-decoder.helper';
import {
  getSignerFactoryAbi,
  type SignerFactoryAbi,
} from '@/domain/common/utils/deployments';

@Injectable()
export class SignerFactoryDecoder extends AbiDecoder<SignerFactoryAbi> {
  constructor() {
    super(getSignerFactoryAbi());
  }
}
