import { faker } from '@faker-js/faker';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { AddOwner } from '../../entities/settings-changes/add-owner.entity';
import { ChangeMasterCopy } from '../../entities/settings-changes/change-master-copy.entity';
import { ChangeThreshold } from '../../entities/settings-changes/change-threshold.entity';
import { DeleteGuard } from '../../entities/settings-changes/delete-guard';
import { DisableModule } from '../../entities/settings-changes/disable-module.entity';
import { EnableModule } from '../../entities/settings-changes/enable-module.entity';
import { RemoveOwner } from '../../entities/settings-changes/remove-owner.entity';
import { SetFallbackHandler } from '../../entities/settings-changes/set-fallback-handler.entity';
import { SetGuard } from '../../entities/settings-changes/set-guard.entity';
import { SwapOwner } from '../../entities/settings-changes/swap-owner.entity';
import { DataDecodedParamHelper } from './data-decoded-param.helper';
import { SettingsChangeMapper } from './settings-change.mapper';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as unknown as AddressInfoHelper);

describe('Multisig Settings Change Transaction mapper (Unit)', () => {
  const mapper = new SettingsChangeMapper(
    addressInfoHelper,
    new DataDecodedParamHelper(),
  );

  it('should build a SetFallbackHandler setting', async () => {
    const safe = safeBuilder().build();
    const handlerValue = faker.random.numeric();
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'setFallbackHandler',
        parameters: [{ value: handlerValue }],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(SetFallbackHandler);
    expect(settingChange).toHaveProperty('handler', handlerValue);
  });

  it('should build a SetFallbackHandler setting with a null handler', async () => {
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'setFallbackHandler',
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(SetFallbackHandler);
    expect(settingChange).toHaveProperty('handler', null);
  });

  it('should build a AddOwner setting', async () => {
    const safe = safeBuilder().build();
    const ownerValue = faker.random.numeric();
    const thresholdValue = faker.random.numeric();
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'addOwnerWithThreshold',
        parameters: [{ value: ownerValue }, { value: thresholdValue }],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(AddOwner);
    expect(settingChange).toHaveProperty('owner', new AddressInfo(ownerValue));
    expect(settingChange).toHaveProperty('threshold', Number(thresholdValue));
  });

  it('should build a RemoveOwner setting', async () => {
    const safe = safeBuilder().build();
    const ownerValue = faker.random.numeric();
    const thresholdValue = faker.random.numeric();
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'removeOwner',
        parameters: [
          { value: faker.random.numeric() },
          { value: ownerValue },
          { value: thresholdValue },
        ],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(RemoveOwner);
    expect(settingChange).toHaveProperty('owner', new AddressInfo(ownerValue));
    expect(settingChange).toHaveProperty('threshold', Number(thresholdValue));
  });

  it('should build a SwapOwner setting', async () => {
    const safe = safeBuilder().build();
    const oldOwner = faker.random.numeric();
    const newOwner = faker.random.numeric();
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'swapOwner',
        parameters: [
          { value: faker.random.numeric() },
          { value: oldOwner },
          { value: newOwner },
        ],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(SwapOwner);
    expect(settingChange).toHaveProperty('oldOwner', new AddressInfo(oldOwner));
    expect(settingChange).toHaveProperty('newOwner', new AddressInfo(newOwner));
  });

  it('should build a ChangeMasterCopy setting', async () => {
    const safe = safeBuilder().build();
    const masterCopyAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValueOnce(masterCopyAddress);
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'changeMasterCopy',
        parameters: [],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(ChangeMasterCopy);
    expect(settingChange).toHaveProperty('implementation', masterCopyAddress);
  });

  it('should build a EnableModule setting', async () => {
    const safe = safeBuilder().build();
    const moduleAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValueOnce(moduleAddress);
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'enableModule',
        parameters: [{ value: faker.random.numeric() }],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(EnableModule);
    expect(settingChange).toHaveProperty('module', moduleAddress);
  });

  it('should build a DisableModule setting', async () => {
    const safe = safeBuilder().build();
    const moduleAddress = new AddressInfo(faker.finance.ethereumAddress());
    addressInfoHelper.getOrDefault.mockResolvedValueOnce(moduleAddress);
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'disableModule',
        parameters: [{ value: faker.random.numeric() }],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(DisableModule);
    expect(settingChange).toHaveProperty('module', moduleAddress);
  });

  it('should build a ChangeThreshold setting', async () => {
    const safe = safeBuilder().build();
    const thresholdValue = faker.random.numeric();
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'changeThreshold',
        parameters: [{ value: thresholdValue }],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(ChangeThreshold);
    expect(settingChange).toHaveProperty('threshold', thresholdValue);
  });

  it('should build a SetGuard setting', async () => {
    const safe = safeBuilder().build();
    const guardValue = faker.finance.ethereumAddress();
    const guardAddress = new AddressInfo(guardValue);
    addressInfoHelper.getOrDefault.mockResolvedValueOnce(guardAddress);
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'setGuard',
        parameters: [{ value: guardValue }],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(SetGuard);
    expect(settingChange).toHaveProperty('guard', guardAddress);
  });

  it('should build a DeleteGuard setting', async () => {
    const safe = safeBuilder().build();
    const guardValue = '0x0000000000000000000000000000000000000000';
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'setGuard',
        parameters: [{ value: guardValue }],
      })
      .build();

    const settingChange = await mapper.mapSettingsChange(
      faker.random.numeric(),
      transaction,
      safe,
    );

    expect(settingChange).toBeInstanceOf(DeleteGuard);
  });

  it('should throw an error on a unknown setting', async () => {
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('dataDecoded', {
        method: 'unknownMethod',
        parameters: [],
      })
      .build();

    await expect(
      mapper.mapSettingsChange(faker.random.numeric(), transaction, safe),
    ).rejects.toThrow();
  });
});
