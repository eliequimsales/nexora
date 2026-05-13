export interface ActivityLogItem {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  leadId: string;
  leadName: string;
  userId: string | null;
  userName: string | null;
  userAvatarUrl: string | null;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  orgId: string;
  actorId: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  resourceName: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
