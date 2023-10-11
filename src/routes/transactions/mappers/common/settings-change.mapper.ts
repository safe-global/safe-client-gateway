import { Injectable } from '@nestjs/common';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
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
import { SettingsChange } from '@/routes/transactions/entities/settings-changes/settings-change.entity';
import { SwapOwner } from '@/routes/transactions/entities/settings-changes/swap-owner.entity';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';

@Injectable()
export class SettingsChangeMapper {
  private static readonly SET_FALLBACK_HANDLER = 'setFallbackHandler';
  private static readonly ADD_OWNER_WITH_THRESHOLD = 'addOwnerWithThreshold';
  private static readonly REMOVE_OWNER = 'removeOwner';
  private static readonly SWAP_OWNER = 'swapOwner';
  private static readonly CHANGE_THRESHOLD = 'changeThreshold';
  private static readonly CHANGE_MASTER_COPY = 'changeMasterCopy';
  private static readonly ENABLE_MODULE = 'enableModule';
  private static readonly DISABLE_MODULE = 'disableModule';
  private static readonly SET_GUARD = 'setGuard';

  public static readonly SETTINGS_CHANGE_METHODS = [
    SettingsChangeMapper.SET_FALLBACK_HANDLER,
    SettingsChangeMapper.ADD_OWNER_WITH_THRESHOLD,
    SettingsChangeMapper.REMOVE_OWNER,
    SettingsChangeMapper.SWAP_OWNER,
    SettingsChangeMapper.CHANGE_THRESHOLD,
    SettingsChangeMapper.CHANGE_MASTER_COPY,
    SettingsChangeMapper.ENABLE_MODULE,
    SettingsChangeMapper.DISABLE_MODULE,
    SettingsChangeMapper.SET_GUARD,
  ];

  constructor(
    private readonly addressInfoHelper: AddressInfoHelper,
    private readonly dataDecodedParamHelper: DataDecodedParamHelper,
  ) {}

  private async handleFallbackHandler(
    chainId: string,
    dataDecoded: DataDecoded,
  ): Promise<SetFallbackHandler | null> {
    const handler: unknown = this.dataDecodedParamHelper.getValueAtPosition(
      dataDecoded,
      0,
    );
    if (typeof handler !== 'string') return null;
    const addressInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      handler,
      ['CONTRACT'],
    );
    return new SetFallbackHandler(addressInfo);
  }

  private handleAddOwnerWithThreshold(
    dataDecoded: DataDecoded,
  ): AddOwner | null {
    const owner: unknown = this.dataDecodedParamHelper.getValueAtPosition(
      dataDecoded,
      0,
    );
    const threshold = Number(
      this.dataDecodedParamHelper.getValueAtPosition(dataDecoded, 1),
    );

    if (typeof owner !== 'string') return null;
    if (isNaN(threshold)) return null;

    return new AddOwner(new AddressInfo(owner), threshold);
  }

  private handleRemoveOwner(dataDecoded: DataDecoded): RemoveOwner | null {
    const owner: unknown = this.dataDecodedParamHelper.getValueAtPosition(
      dataDecoded,
      1,
    );
    const threshold = Number(
      this.dataDecodedParamHelper.getValueAtPosition(dataDecoded, 2),
    );

    if (typeof owner !== 'string') return null;
    if (isNaN(threshold)) return null;

    return new RemoveOwner(new AddressInfo(owner), threshold);
  }

  private handleSwapOwner(dataDecoded: DataDecoded): SwapOwner | null {
    const oldOwner: unknown = this.dataDecodedParamHelper.getValueAtPosition(
      dataDecoded,
      1,
    );
    const newOwner: unknown = this.dataDecodedParamHelper.getValueAtPosition(
      dataDecoded,
      2,
    );

    if (typeof oldOwner !== 'string') return null;
    if (typeof newOwner !== 'string') return null;

    return new SwapOwner(new AddressInfo(oldOwner), new AddressInfo(newOwner));
  }

  private async handleChangeMasterCopy(
    chainId: string,
    dataDecoded: DataDecoded,
  ): Promise<ChangeMasterCopy | null> {
    const implementation: unknown =
      this.dataDecodedParamHelper.getValueAtPosition(dataDecoded, 0);

    if (typeof implementation !== 'string') return null;

    const implementationInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      implementation,
      ['CONTRACT'],
    );
    return new ChangeMasterCopy(implementationInfo);
  }

  private async handleEnableModule(
    chainId: string,
    dataDecoded: DataDecoded,
  ): Promise<EnableModule | null> {
    const module: unknown = this.dataDecodedParamHelper.getValueAtPosition(
      dataDecoded,
      0,
    );

    if (typeof module !== 'string') return null;

    const moduleInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      module,
      ['CONTRACT'],
    );
    return new EnableModule(moduleInfo);
  }

  private async handleDisableModule(
    chainId: string,
    dataDecoded: DataDecoded,
  ): Promise<DisableModule | null> {
    const module: unknown = this.dataDecodedParamHelper.getValueAtPosition(
      dataDecoded,
      1,
    );

    if (typeof module !== 'string') return null;

    const moduleInfo = await this.addressInfoHelper.getOrDefault(
      chainId,
      module,
      ['CONTRACT'],
    );
    return new DisableModule(moduleInfo);
  }

  private handleChangeThreshold(
    dataDecoded: DataDecoded,
  ): ChangeThreshold | null {
    const threshold = Number(
      this.dataDecodedParamHelper.getValueAtPosition(dataDecoded, 0),
    );

    if (isNaN(threshold)) return null;

    return new ChangeThreshold(threshold);
  }

  private async handleSetGuard(
    chainId: string,
    dataDecoded: DataDecoded,
  ): Promise<DeleteGuard | SetGuard | null> {
    const guardValue: unknown = this.dataDecodedParamHelper.getValueAtPosition(
      dataDecoded,
      0,
    );

    if (typeof guardValue !== 'string') return null;

    if (guardValue !== NULL_ADDRESS) {
      const guardAddressInfo = await this.addressInfoHelper.getOrDefault(
        chainId,
        guardValue,
        ['CONTRACT'],
      );
      return new SetGuard(guardAddressInfo);
    } else {
      return new DeleteGuard();
    }
  }

  async mapSettingsChange(
    chainId: string,
    transaction: MultisigTransaction | ModuleTransaction,
  ): Promise<SettingsChange | null> {
    const { dataDecoded } = transaction;

    switch (dataDecoded?.method) {
      case SettingsChangeMapper.SET_FALLBACK_HANDLER:
        return this.handleFallbackHandler(chainId, dataDecoded);
      case SettingsChangeMapper.ADD_OWNER_WITH_THRESHOLD:
        return this.handleAddOwnerWithThreshold(dataDecoded);
      case SettingsChangeMapper.REMOVE_OWNER:
        return this.handleRemoveOwner(dataDecoded);
      case SettingsChangeMapper.SWAP_OWNER:
        return this.handleSwapOwner(dataDecoded);
      case SettingsChangeMapper.CHANGE_MASTER_COPY:
        return this.handleChangeMasterCopy(chainId, dataDecoded);
      case SettingsChangeMapper.ENABLE_MODULE:
        return this.handleEnableModule(chainId, dataDecoded);
      case SettingsChangeMapper.DISABLE_MODULE:
        return this.handleDisableModule(chainId, dataDecoded);
      case SettingsChangeMapper.CHANGE_THRESHOLD:
        return this.handleChangeThreshold(dataDecoded);
      case SettingsChangeMapper.SET_GUARD:
        return this.handleSetGuard(chainId, dataDecoded);
    }

    throw new Error(`Unknown setting method: ${dataDecoded?.method}`);
  }
}
