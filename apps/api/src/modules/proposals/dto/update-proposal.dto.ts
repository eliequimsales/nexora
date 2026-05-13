import {
  IsString, IsOptional, IsArray, IsNumber, IsUUID,
  MaxLength, Min, ValidateNested, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProposalItemDto } from './create-proposal.dto';

export class UpdateProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProposalItemDto)
  items?: CreateProposalItemDto[];
}
