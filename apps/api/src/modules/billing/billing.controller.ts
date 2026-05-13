import {
  Controller, Post, Get, Body, Headers, RawBodyRequest, Req,
  HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { RequirePermission } from '../../common/rbac/permissions';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('summary')
  @RequirePermission('org:read')
  getSummary(@CurrentUser() ctx: TenantContext) {
    return this.billingService.getSummary(ctx.orgId);
  }

  @Post('checkout')
  @RequirePermission('org:update')
  createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() ctx: TenantContext,
  ) {
    return this.billingService.createCheckoutSession(ctx.orgId, dto.priceId, ctx.userId);
  }

  @Post('portal')
  @RequirePermission('org:update')
  createPortal(@CurrentUser() ctx: TenantContext) {
    return this.billingService.createPortalSession(ctx.orgId);
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) throw new BadRequestException('Missing stripe-signature header');
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Missing raw body');
    await this.billingService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
