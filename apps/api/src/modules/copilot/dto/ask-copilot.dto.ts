import { IsString, IsUUID, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class AskCopilotDto {
  @IsOptional()
  @IsUUID()
  leadId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;
}
