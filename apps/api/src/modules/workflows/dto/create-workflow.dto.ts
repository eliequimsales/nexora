import {
  IsString, IsOptional, IsBoolean, IsIn, IsObject,
  MaxLength, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export const TRIGGER_TYPES = [
  'lead_created',
  'lead_status_changed',
  'lead_stage_changed',
  'lead_classified',
] as const;

export const ACTION_TYPES = [
  'ai_classify',
  'ai_respond',
  'ai_follow_up',
  'create_task',
  'move_stage',
  'update_status',
] as const;

export type TriggerType = typeof TRIGGER_TYPES[number];
export type ActionType = typeof ACTION_TYPES[number];

export class CreateWorkflowDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsIn(TRIGGER_TYPES)
  triggerType!: TriggerType;

  @IsOptional()
  @IsObject()
  triggerConditions?: Record<string, unknown> = {};

  @IsIn(ACTION_TYPES)
  actionType!: ActionType;

  @IsOptional()
  @IsObject()
  actionConfig?: Record<string, unknown> = {};
}
