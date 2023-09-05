import {
  AddressFragment,
  NumberFragment,
  TextFragment,
  ValueType,
} from '@/domain/human-description/entities/human-description.entity';

export interface RichTokenValueFragment {
  type: ValueType.TokenValue;
  value: string;
  symbol: string | null;
  logoUri: string | null;
}

export interface RichTextFragment extends TextFragment {}
export interface RichAddressFragment extends AddressFragment {}
export interface RichNumberFragment extends NumberFragment {}

export type RichHumanDescriptionFragment =
  | RichTokenValueFragment
  | RichTextFragment
  | RichAddressFragment
  | RichNumberFragment;

export type RichInfo = {
  fragments: RichHumanDescriptionFragment[];
};
