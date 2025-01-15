import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { PortfolioAsset } from '@/routes/portfolio/entities/portfolio-asset.entity';

type Position = {
  name: string;
  assets: Array<PortfolioAsset>;
  value: string;
};

enum PositionType {
  Regular = 'REGULAR',
  Complex = 'COMPLEX',
}

export class RegularPosition implements Position {
  @ApiProperty({ enum: [PositionType.Regular] })
  type = PositionType.Regular;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: PortfolioAsset, isArray: true })
  assets: Array<PortfolioAsset>;

  @ApiProperty()
  value: string;

  constructor(args: {
    name: string;
    assets: Array<PortfolioAsset>;
    value: string;
  }) {
    this.name = args.name;
    this.assets = args.assets;
    this.value = args.value;
  }
}

export class ComplexPositionPosition
  extends RegularPosition
  implements Position
{
  @ApiPropertyOptional({
    type: String,
    nullable: true,
  })
  healthRate?: string;

  constructor(args: {
    name: string;
    value: string;
    healthRate?: string;
    assets: Array<PortfolioAsset>;
  }) {
    super({
      name: args.name,
      assets: args.assets,
      value: args.value,
    });
    this.healthRate = args.healthRate;
  }
}

export class ComplexPosition {
  @ApiProperty({ enum: [PositionType.Complex] })
  type = PositionType.Complex;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: ComplexPositionPosition, isArray: true })
  positions: Array<ComplexPositionPosition>;

  constructor(args: {
    name: string;
    positions: Array<ComplexPositionPosition>;
  }) {
    this.name = args.name;
    this.positions = args.positions;
  }
}

export class PositionItem {
  @ApiProperty()
  value: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  logoUri: string;

  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(RegularPosition) },
      { $ref: getSchemaPath(ComplexPosition) },
    ],
    isArray: true,
  })
  protocolPositions: Array<RegularPosition | ComplexPosition>;

  constructor(args: {
    value: string;
    name: string;
    logoUri: string;
    protocolPositions: Array<RegularPosition | ComplexPosition>;
  }) {
    this.value = args.value;
    this.name = args.name;
    this.logoUri = args.logoUri;
    this.protocolPositions = args.protocolPositions;
  }
}
