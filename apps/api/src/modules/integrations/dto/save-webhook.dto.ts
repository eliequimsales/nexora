import { IsString, IsUrl, IsArray, IsIn, IsBoolean, IsOptional, ArrayMinSize } from 'class-validator';

const VALID_EVENTS = ['lead.created', 'lead.status_changed', 'proposal.accepted', 'proposal.rejected'];

export class SaveWebhookDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(VALID_EVENTS, { each: true })
  events!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
