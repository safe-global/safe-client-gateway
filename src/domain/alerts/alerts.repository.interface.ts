import { AlertsDeletion } from '@/domain/alerts/entities/alerts-deletion.entity';
import { AlertsRegistration } from '@/domain/alerts/entities/alerts-registration.entity';
import { AlertLog } from '@/routes/alerts/entities/alert.dto.entity';

export const IAlertsRepository = Symbol('IAlertsRepository');

export interface IAlertsRepository {
  /**
   * Adds the {@link contract} to the Alerts provider
   * @param contract - the network-specific {@link AlertsRegistration} to add
   */
  addContract(contract: AlertsRegistration): Promise<void>;

  /**
   * Deletes the {@link contract} from the Alerts provider
   * @param contract - the network-specific {@link AlertsDeletion} to add
   */
  deleteContract(contract: AlertsDeletion): Promise<void>;

  /**
   * Parses and notifies the user about the {@link log} from the Alerts provider
   * @param chainId - chain where the alert log was generated
   * @param log - the {@link AlertLog} to decode
   */
  handleAlertLog(chainId: string, log: AlertLog): Promise<void>;
}
