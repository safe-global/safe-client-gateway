// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '#/modules/data-decoder/domain/v2/entities/__tests__/data-decoded.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import { AddOwner } from '#/modules/transactions/routes/entities/settings-changes/add-owner.entity';
import { ChangeMasterCopy } from '#/modules/transactions/routes/entities/settings-changes/change-master-copy.entity';
import { ChangeThreshold } from '#/modules/transactions/routes/entities/settings-changes/change-threshold.entity';
import { DeleteGuard } from '#/modules/transactions/routes/entities/settings-changes/delete-guard';
import { DeleteModuleGuard } from '#/modules/transactions/routes/entities/settings-changes/delete-module-guard.entity';
import { DisableModule } from '#/modules/transactions/routes/entities/settings-changes/disable-module.entity';
import { EnableModule } from '#/modules/transactions/routes/entities/settings-changes/enable-module.entity';
import { RemoveOwner } from '#/modules/transactions/routes/entities/settings-changes/remove-owner.entity';
import { SetFallbackHandler } from '#/modules/transactions/routes/entities/settings-changes/set-fallback-handler.entity';
import { SetGuard } from '#/modules/transactions/routes/entities/settings-changes/set-guard.entity';
import { SetModuleGuard } from '#/modules/transactions/routes/entities/settings-changes/set-module-guard.entity';
import { SwapOwner } from '#/modules/transactions/routes/entities/settings-changes/swap-owner.entity';
import { DataDecodedParamHelper } from '#/modules/transactions/routes/mappers/common/data-decoded-param.helper';
import { SettingsChangeMapper } from '#/modules/transactions/routes/mappers/common/settings-change.mapper';
import type { AddressLookups } from '#/routes/common/address-info/address-lookups';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

const addressLookups = vi.mocked({
  getOrDefault: vi.fn(),
} as MockedObject<AddressLookups>);

describe('Multisig Settings Change Transaction mapper (Unit)', () => {
  let mapper: SettingsChangeMapper;

  beforeEach(() => {
    mapper = new SettingsChangeMapper(new DataDecodedParamHelper());
  });

  it('should build a SetFallbackHandler setting', async () => {
    const handlerValue = faker.finance.ethereumAddress();
    addressLookups.getOrDefault.mockResolvedValue(
      new AddressInfo(handlerValue),
    );
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setFallbackHandler')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', handlerValue).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new SetFallbackHandler(new AddressInfo(handlerValue));
    expect(actual).toEqual(expected);
  });

  it('should build a SetFallbackHandler setting with a null handler', async () => {
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setFallbackHandler')
      .with('parameters', [])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    expect(actual).toBeNull();
  });

  it('should build a AddOwner setting', async () => {
    const ownerValue = faker.string.numeric();
    const thresholdValue = faker.string.numeric();
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'addOwnerWithThreshold')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', ownerValue).build(),
        dataDecodedParameterBuilder().with('value', thresholdValue).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new AddOwner(
      new AddressInfo(ownerValue),
      Number(thresholdValue),
    );
    expect(actual).toEqual(expected);
  });

  it('should build a RemoveOwner setting', async () => {
    const ownerValue = faker.finance.ethereumAddress();
    const thresholdValue = faker.string.numeric();
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'removeOwner')
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('value', faker.string.numeric())
          .build(),
        dataDecodedParameterBuilder().with('value', ownerValue).build(),
        dataDecodedParameterBuilder().with('value', thresholdValue).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new RemoveOwner(
      new AddressInfo(ownerValue),
      Number(thresholdValue),
    );
    expect(actual).toEqual(expected);
  });

  it('should build a SwapOwner setting', async () => {
    const oldOwner = faker.string.numeric();
    const newOwner = faker.string.numeric();
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'swapOwner')
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('value', faker.string.numeric())
          .build(),
        dataDecodedParameterBuilder().with('value', oldOwner).build(),
        dataDecodedParameterBuilder().with('value', newOwner).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new SwapOwner(
      new AddressInfo(oldOwner),
      new AddressInfo(newOwner),
    );
    expect(actual).toEqual(expected);
  });

  it('should build a ChangeMasterCopy setting', async () => {
    const newMasterCopy = faker.finance.ethereumAddress();
    addressLookups.getOrDefault.mockResolvedValue(
      new AddressInfo(newMasterCopy),
    );
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'changeMasterCopy')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', newMasterCopy).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new ChangeMasterCopy(new AddressInfo(newMasterCopy));
    expect(actual).toEqual(expected);
  });

  it('should build a EnableModule setting', async () => {
    const moduleAddress = faker.finance.ethereumAddress();
    addressLookups.getOrDefault.mockResolvedValue(
      new AddressInfo(moduleAddress),
    );
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'enableModule')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', moduleAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new EnableModule(new AddressInfo(moduleAddress));
    expect(actual).toEqual(expected);
  });

  it('should build a DisableModule setting', async () => {
    const moduleAddress = faker.finance.ethereumAddress();
    addressLookups.getOrDefault.mockResolvedValue(
      new AddressInfo(moduleAddress),
    );
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'disableModule')
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('value', faker.finance.ethereumAddress())
          .build(),
        dataDecodedParameterBuilder().with('value', moduleAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new DisableModule(new AddressInfo(moduleAddress));
    expect(actual).toEqual(expected);
  });

  it('should build a ChangeThreshold setting', async () => {
    const thresholdValue = faker.string.numeric();
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'changeThreshold')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', thresholdValue).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new ChangeThreshold(Number(thresholdValue));
    expect(actual).toEqual(expected);
  });

  it('should build a SetGuard setting', async () => {
    const guardAddress = faker.finance.ethereumAddress();
    const guardAddressInfo = new AddressInfo(guardAddress);
    addressLookups.getOrDefault.mockResolvedValue(guardAddressInfo);
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setGuard')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', guardAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new SetGuard(new AddressInfo(guardAddress));
    expect(actual).toEqual(expected);
  });

  it('should build a DeleteGuard setting without a guard when the transaction is not queued', async () => {
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setGuard')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', zeroAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    expect(actual).toEqual(new DeleteGuard(null));
    expect(addressLookups.getOrDefault).not.toHaveBeenCalled();
  });

  it('should build a DeleteGuard setting with the current guard of a queued Safe', async () => {
    const safe = safeBuilder().build();
    const guardAddressInfo = new AddressInfo(safe.guard);
    addressLookups.getOrDefault.mockResolvedValue(guardAddressInfo);
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setGuard')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', zeroAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      safe,
    );

    expect(actual).toEqual(new DeleteGuard(guardAddressInfo));
    expect(addressLookups.getOrDefault).toHaveBeenCalledWith(safe.guard, [
      'CONTRACT',
    ]);
  });

  it('should build a DeleteGuard setting without a guard when the queued Safe has none', async () => {
    const safe = safeBuilder().with('guard', zeroAddress).build();
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setGuard')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', zeroAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      safe,
    );

    expect(actual).toEqual(new DeleteGuard(null));
    expect(addressLookups.getOrDefault).not.toHaveBeenCalled();
  });

  it('should build a SetModuleGuard setting', async () => {
    const moduleGuardAddress = faker.finance.ethereumAddress();
    const moduleGuardAddressInfo = new AddressInfo(moduleGuardAddress);
    addressLookups.getOrDefault.mockResolvedValue(moduleGuardAddressInfo);
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setModuleGuard')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', moduleGuardAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    const expected = new SetModuleGuard(new AddressInfo(moduleGuardAddress));
    expect(actual).toEqual(expected);
  });

  it('should build a DeleteModuleGuard setting without a module guard when the transaction is not queued', async () => {
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setModuleGuard')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', zeroAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      null,
    );

    expect(actual).toEqual(new DeleteModuleGuard(null));
    expect(addressLookups.getOrDefault).not.toHaveBeenCalled();
  });

  it('should build a DeleteModuleGuard setting with the current module guard of a queued Safe', async () => {
    const moduleGuard = getAddress(faker.finance.ethereumAddress());
    const safe = safeBuilder().with('moduleGuard', moduleGuard).build();
    const moduleGuardAddressInfo = new AddressInfo(moduleGuard);
    addressLookups.getOrDefault.mockResolvedValue(moduleGuardAddressInfo);
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'setModuleGuard')
      .with('parameters', [
        dataDecodedParameterBuilder().with('value', zeroAddress).build(),
      ])
      .build();

    const actual = await mapper.mapSettingsChange(
      addressLookups,
      dataDecoded,
      safe,
    );

    expect(actual).toEqual(new DeleteModuleGuard(moduleGuardAddressInfo));
    expect(addressLookups.getOrDefault).toHaveBeenCalledWith(moduleGuard, [
      'CONTRACT',
    ]);
  });

  it.each([null, zeroAddress])(
    'should build a DeleteModuleGuard setting without a module guard when the queued Safe module guard is %s',
    async (moduleGuard) => {
      const safe = safeBuilder().with('moduleGuard', moduleGuard).build();
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'setModuleGuard')
        .with('parameters', [
          dataDecodedParameterBuilder().with('value', zeroAddress).build(),
        ])
        .build();

      const actual = await mapper.mapSettingsChange(
        addressLookups,
        dataDecoded,
        safe,
      );

      expect(actual).toEqual(new DeleteModuleGuard(null));
      expect(addressLookups.getOrDefault).not.toHaveBeenCalled();
    },
  );

  it('should throw an error on a unknown setting', async () => {
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'unknownMethod')
      .with('parameters', [])
      .build();

    await expect(
      mapper.mapSettingsChange(addressLookups, dataDecoded, null),
    ).rejects.toThrow();
  });
});
