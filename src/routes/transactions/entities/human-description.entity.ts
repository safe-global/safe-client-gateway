import {
  InfoFragment,
  ValueType,
} from '@/domain/human-description/entities/human-description.entity';

interface RichInfoFragment extends InfoFragment {
  richData: Record<string, unknown> | null;
}

export interface RichTokenValueFragment extends RichInfoFragment {
  type: ValueType.TokenValue;
  value: string;
  richData: {
    symbol: string | null;
    logoUri: string | null;
  };
}

export interface RichTextFragment extends RichInfoFragment {}
export interface RichAddressFragment extends RichInfoFragment {}
export interface RichNumberFragment extends RichInfoFragment {}

export type RichHumanDescriptionFragment =
  | RichTokenValueFragment
  | RichTextFragment
  | RichAddressFragment
  | RichNumberFragment;

export type RichInfo = {
  fragments: RichHumanDescriptionFragment[];
};
