import {
  IsString, IsOptional, IsArray, IsNumber, IsUUID,
  MaxLength, Min, ValidateNested, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProposalItemDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

export class CreateProposalDto {
  @IsUUID()
  leadId!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProposalItemDto)
  items!: CreateProposalItemDto[];
}
