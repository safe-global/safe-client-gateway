// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  type Address,
  encodeFunctionData,
  getAddress,
  type Hex,
  keccak256,
  toHex,
} from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IEncoder } from '@/__tests__/encoder-builder';
import { SafeGuardManagerAbi } from '@/modules/policies/domain/contracts/decoders/safe-guard-manager-decoder.helper';
import { SafePolicyGuardAbi } from '@/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';

// configureImmediately / applyConfiguration

type ConfigurationsArgs = {
  configurations: Array<PolicyConfiguration>;
};

class ConfigureImmediatelyEncoder<T extends ConfigurationsArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: SafePolicyGuardAbi,
      functionName: 'configureImmediately',
      args: [args.configurations],
    });
  }
}

export function configureImmediatelyEncoder(): ConfigureImmediatelyEncoder<ConfigurationsArgs> {
  return new ConfigureImmediatelyEncoder().with('configurations', [
    policyConfigurationBuilder().build(),
  ]);
}

class ApplyConfigurationEncoder<T extends ConfigurationsArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: SafePolicyGuardAbi,
      functionName: 'applyConfiguration',
      args: [args.configurations],
    });
  }
}

export function applyConfigurationEncoder(): ApplyConfigurationEncoder<ConfigurationsArgs> {
  return new ApplyConfigurationEncoder().with('configurations', [
    policyConfigurationBuilder().build(),
  ]);
}

// requestConfiguration

type RequestConfigurationArgs = {
  configureRoot: Hex;
};

class RequestConfigurationEncoder<T extends RequestConfigurationArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: SafePolicyGuardAbi,
      functionName: 'requestConfiguration',
      args: [args.configureRoot],
    });
  }
}

export function requestConfigurationEncoder(): RequestConfigurationEncoder<RequestConfigurationArgs> {
  return new RequestConfigurationEncoder().with(
    'configureRoot',
    keccak256(toHex(faker.string.alphanumeric(32))),
  );
}

// setModuleGuard

type SetModuleGuardArgs = {
  moduleGuard: Address;
};

class SetModuleGuardEncoder<T extends SetModuleGuardArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: SafeGuardManagerAbi,
      functionName: 'setModuleGuard',
      args: [args.moduleGuard],
    });
  }
}

export function setModuleGuardEncoder(): SetModuleGuardEncoder<SetModuleGuardArgs> {
  return new SetModuleGuardEncoder().with(
    'moduleGuard',
    getAddress(faker.finance.ethereumAddress()),
  );
}
