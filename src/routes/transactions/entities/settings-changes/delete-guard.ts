import { SettingsChange } from '@/routes/transactions/entities/settings-changes/settings-change.entity';

export class DeleteGuard extends SettingsChange {
  constructor() {
    super('DELETE_GUARD');
  }
}
