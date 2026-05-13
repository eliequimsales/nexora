export interface TenantContext {
  readonly userId: string;
  readonly orgId: string;
  readonly role: 'admin' | 'member';
  readonly tokenId: string;
}
