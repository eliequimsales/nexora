import { IsString, IsNotEmpty } from 'class-validator';

export class ApplyTemplateDto {
  @IsString()
  @IsNotEmpty()
  templateId!: string;
}
