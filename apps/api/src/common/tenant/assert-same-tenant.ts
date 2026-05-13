import { NotFoundException } from '@nestjs/common';

/**
 * Garante que uma entidade pertence ao tenant do contexto.
 * Lança NotFoundException (não ForbiddenException) para não revelar
 * a existência de recursos de outros tenants.
 */
export function assertSameTenant(entityOrgId: string, ctxOrgId: string): void {
  if (entityOrgId !== ctxOrgId) {
    throw new NotFoundException();
  }
}
