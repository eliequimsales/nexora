import { IsString, IsOptional, IsBoolean, IsIn, IsObject, MaxLength } from 'class-validator';
import { TRIGGER_TYPES, ACTION_TYPES, type TriggerType, type ActionType } from './create-workflow.dto';

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(TRIGGER_TYPES)
  triggerType?: TriggerType;

  @IsOptional()
  @IsObject()
  triggerConditions?: Record<string, unknown>;

  @IsOptional()
  @IsIn(ACTION_TYPES)
  actionType?: ActionType;

  @IsOptional()
  @IsObject()
  actionConfig?: Record<string, unknown>;
}
