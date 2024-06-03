import { faker } from '@faker-js/faker';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { AddOwner } from '@/routes/transactions/entities/settings-changes/add-owner.entity';
import { ChangeMasterCopy } from '@/routes/transactions/entities/settings-changes/change-master-copy.entity';
import { ChangeThreshold } from '@/routes/transactions/entities/settings-changes/change-threshold.entity';
import { DeleteGuard } from '@/routes/transactions/entities/settings-changes/delete-guard';
import { DisableModule } from '@/routes/transactions/entities/settings-changes/disable-module.entity';
import { EnableModule } from '@/routes/transactions/entities/settings-changes/enable-module.entity';
import { RemoveOwner } from '@/routes/transactions/entities/settings-changes/remove-owner.entity';
import { SetFallbackHandler } from '@/routes/transactions/entities/settings-changes/set-fallback-handler.entity';
import { SetGuard } from '@/routes/transactions/entities/settings-changes/set-guard.entity';
import { SwapOwner } from '@/routes/transactions/entities/settings-changes/swap-owner.entity';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { SettingsChangeMapper } from '@/routes/transactions/mappers/common/settings-change.mapper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

describe('Multisig Settings Change Transaction mapper (Unit)', () => {
  let mapper: SettingsChangeMapper;

  beforeEach(() => {
    mapper = new SettingsChangeMapper(
      addressInfoHelper,
      new DataDecodedParamHelper(),
    );
  });

  it('should build a SetFallbackHandler setting', async () => {
    const handlerValue = faker.finance.ethereumAddress();
    addressInfoHelper.getOrDefault.mockResolvedValue(
      new AddressInfo(handlerValue),
    );
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'setFallbackHandler')
          .with('parameters', [
            dataDecodedParameterBuilder().with('value', handlerValue).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    const expected = new SetFallbackHandler(new AddressInfo(handlerValue));
    expect(actual).toEqual(expected);
  });

  it('should build a SetFallbackHandler setting with a null handler', async () => {
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'setFallbackHandler')
          .with('parameters', [])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    expect(actual).toBeNull();
  });

  it('should build a AddOwner setting', async () => {
    const ownerValue = faker.string.numeric();
    const thresholdValue = faker.string.numeric();
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'addOwnerWithThreshold')
          .with('parameters', [
            dataDecodedParameterBuilder().with('value', ownerValue).build(),
            dataDecodedParameterBuilder().with('value', thresholdValue).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
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
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'removeOwner')
          .with('parameters', [
            dataDecodedParameterBuilder()
              .with('value', faker.string.numeric())
              .build(),
            dataDecodedParameterBuilder().with('value', ownerValue).build(),
            dataDecodedParameterBuilder().with('value', thresholdValue).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
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
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'swapOwner')
          .with('parameters', [
            dataDecodedParameterBuilder()
              .with('value', faker.string.numeric())
              .build(),
            dataDecodedParameterBuilder().with('value', oldOwner).build(),
            dataDecodedParameterBuilder().with('value', newOwner).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    const expected = new SwapOwner(
      new AddressInfo(oldOwner),
      new AddressInfo(newOwner),
    );
    expect(actual).toEqual(expected);
  });

  it('should build a ChangeMasterCopy setting', async () => {
    const newMasterCopy = faker.finance.ethereumAddress();
    addressInfoHelper.getOrDefault.mockResolvedValue(
      new AddressInfo(newMasterCopy),
    );
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'changeMasterCopy')
          .with('parameters', [
            dataDecodedParameterBuilder().with('value', newMasterCopy).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    const expected = new ChangeMasterCopy(new AddressInfo(newMasterCopy));
    expect(actual).toEqual(expected);
  });

  it('should build a EnableModule setting', async () => {
    const moduleAddress = faker.finance.ethereumAddress();
    addressInfoHelper.getOrDefault.mockResolvedValue(
      new AddressInfo(moduleAddress),
    );
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'enableModule')
          .with('parameters', [
            dataDecodedParameterBuilder().with('value', moduleAddress).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    const expected = new EnableModule(new AddressInfo(moduleAddress));
    expect(actual).toEqual(expected);
  });

  it('should build a DisableModule setting', async () => {
    const moduleAddress = faker.finance.ethereumAddress();
    addressInfoHelper.getOrDefault.mockResolvedValue(
      new AddressInfo(moduleAddress),
    );
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'disableModule')
          .with('parameters', [
            dataDecodedParameterBuilder()
              .with('value', faker.finance.ethereumAddress())
              .build(),
            dataDecodedParameterBuilder().with('value', moduleAddress).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    const expected = new DisableModule(new AddressInfo(moduleAddress));
    expect(actual).toEqual(expected);
  });

  it('should build a ChangeThreshold setting', async () => {
    const thresholdValue = faker.string.numeric();
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'changeThreshold')
          .with('parameters', [
            dataDecodedParameterBuilder().with('value', thresholdValue).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    const expected = new ChangeThreshold(Number(thresholdValue));
    expect(actual).toEqual(expected);
  });

  it('should build a SetGuard setting', async () => {
    const guardAddress = faker.finance.ethereumAddress();
    const guardAddressInfo = new AddressInfo(guardAddress);
    addressInfoHelper.getOrDefault.mockResolvedValue(guardAddressInfo);
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'setGuard')
          .with('parameters', [
            dataDecodedParameterBuilder().with('value', guardAddress).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    const expected = new SetGuard(new AddressInfo(guardAddress));
    expect(actual).toEqual(expected);
  });

  it('should build a DeleteGuard setting', async () => {
    const guardValue = '0x0000000000000000000000000000000000000000';
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'setGuard')
          .with('parameters', [
            dataDecodedParameterBuilder().with('value', guardValue).build(),
          ])
          .build(),
      )
      .build();

    const actual = await mapper.mapSettingsChange(
      faker.string.numeric(),
      transaction,
    );

    expect(actual).toEqual(new DeleteGuard());
  });

  it('should throw an error on a unknown setting', async () => {
    const transaction = multisigTransactionBuilder()
      .with(
        'dataDecoded',
        dataDecodedBuilder()
          .with('method', 'unknownMethod')
          .with('parameters', [])
          .build(),
      )
      .build();

    await expect(
      mapper.mapSettingsChange(faker.string.numeric(), transaction),
    ).rejects.toThrow();
  });
});
