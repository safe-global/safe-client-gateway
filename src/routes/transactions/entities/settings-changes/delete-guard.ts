import { SettingsChange } from './settings-change.entity';

export class DeleteGuard extends SettingsChange {
  constructor() {
    super('DELETE_GUARD');
  }
}
