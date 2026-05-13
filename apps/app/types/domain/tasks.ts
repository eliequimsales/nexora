export type TaskStatus = 'pending' | 'done';

export interface Task {
  id: string;
  orgId: string;
  leadId: string;
  leadName: string;
  createdBy: string | null;
  createdByName: string | null;
  assignedTo: string | null;
  assignedUserName: string | null;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  leadId: string;
  assignedTo?: string;
  dueDate?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  status?: TaskStatus;
  dueDate?: string | null;
  assignedTo?: string | null;
}

export interface ListTasksParams {
  status?: TaskStatus;
  assignedTo?: string;
  leadId?: string;
  page?: number;
  limit?: number;
}
