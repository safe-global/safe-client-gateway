import { faker } from '@faker-js/faker';
import { random, range, sampleSize } from 'lodash';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { tokenBuilder } from '../../../../domain/tokens/__tests__/token.builder';
import { addressInfoBuilder } from '../../../common/__tests__/entities/address-info.builder';
import {
  MultisigConfirmationDetails,
  MultisigExecutionDetails,
} from '../../entities/transaction-details/multisig-execution-details.entity';

function multisigConfirmationDetailsBuilder(): IBuilder<MultisigConfirmationDetails> {
  return Builder.new<MultisigConfirmationDetails>()
    .with('signer', addressInfoBuilder().build())
    .with('signature', faker.string.hexadecimal())
    .with('submittedAt', faker.number.int());
}

export function multisigExecutionDetailsBuilder(): IBuilder<MultisigExecutionDetails> {
  const signers = range(random(2, 5)).map(() => addressInfoBuilder().build());
  const confirmations = range(random(2, 5)).map(() =>
    multisigConfirmationDetailsBuilder().build(),
  );

  return Builder.new<MultisigExecutionDetails>()
    .with('type', 'MULTISIG')
    .with('submittedAt', faker.number.int())
    .with('nonce', faker.number.int())
    .with('safeTxGas', faker.string.numeric())
    .with('baseGas', faker.string.numeric())
    .with('gasPrice', faker.string.numeric())
    .with('gasToken', faker.finance.ethereumAddress())
    .with('refundReceiver', addressInfoBuilder().build())
    .with('safeTxHash', faker.string.sample())
    .with('executor', addressInfoBuilder().build())
    .with('signers', signers)
    .with('confirmationsRequired', faker.number.int())
    .with('confirmations', confirmations)
    .with('rejectors', sampleSize(signers, 2))
    .with('gasTokenInfo', tokenBuilder().build())
    .with('trusted', faker.datatype.boolean());
}
