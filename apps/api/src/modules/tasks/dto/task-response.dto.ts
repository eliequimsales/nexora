export interface TaskResponseDto {
  id: string;
  orgId: string;
  leadId: string;
  leadName: string;
  createdBy: string | null;
  createdByName: string | null;
  assignedTo: string | null;
  assignedUserName: string | null;
  title: string;
  status: 'pending' | 'done';
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapTask(
  task: any,
  enrichment: {
    leadName: string;
    createdByName: string | null;
    assignedUserName: string | null;
  },
): TaskResponseDto {
  return {
    id: task.id,
    orgId: task.orgId,
    leadId: task.leadId,
    leadName: enrichment.leadName,
    createdBy: task.createdBy ?? null,
    createdByName: enrichment.createdByName,
    assignedTo: task.assignedTo ?? null,
    assignedUserName: enrichment.assignedUserName,
    title: task.title,
    status: task.status as 'pending' | 'done',
    dueDate: task.dueDate ?? null,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}
