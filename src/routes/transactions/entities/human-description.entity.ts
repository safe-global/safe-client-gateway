import { Token } from '@/domain/tokens/entities/token.entity';
import {
  AddressFragment,
  NumberFragment,
  ValueType,
  WordFragment,
} from '@/domain/human-description/entities/human-description.entity';

export interface RichTokenValueFragment {
  type: ValueType.TokenValue;
  value: {
    amount: string;
    token: Token | null;
  };
}

export interface RichWordFragment extends WordFragment {}
export interface RichAddressFragment extends AddressFragment {}
export interface RichNumberFragment extends NumberFragment {}

export type RichHumanDescriptionFragment =
  | RichWordFragment
  | RichTokenValueFragment
  | RichAddressFragment
  | RichNumberFragment;
