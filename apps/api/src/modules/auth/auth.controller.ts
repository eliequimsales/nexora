import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TenantContext } from '../../common/tenant/tenant-context';
import type { AuthResponseDto } from './dto/auth-response.dto';
import type { GoogleProfile } from './strategies/google.strategy';

const COOKIE_NAME = 'refresh_token';

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;
  private readonly refreshTokenTtlDays: number;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    this.isProduction = this.config.get<string>('nodeEnv') === 'production';
    this.refreshTokenTtlDays =
      this.config.get<number>('jwt.refreshTokenTtlDays') ?? 7;
  }

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { refreshToken, ...result } = await this.authService.register(dto);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { refreshToken, ...result } = await this.authService.login(dto);
    this.setRefreshCookie(res, refreshToken);
    return result;
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieValue = (req.cookies as Record<string, string>)[COOKIE_NAME];
    if (!cookieValue) throw new UnauthorizedException();

    const { refreshToken, access_token } = await this.authService.refresh(cookieValue);
    this.setRefreshCookie(res, refreshToken);
    return { access_token };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: TenantContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout(user.userId, user.tokenId);
    this.clearRefreshCookie(res);
  }

  @Get('me')
  async me(@CurrentUser() user: TenantContext) {
    return this.authService.me(user.userId, user.orgId);
  }

  // ─── Google OAuth ─────────────────────────────────────────────────────────

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Guard redireciona para Google — corpo não executado
  }

  @Get('google/enabled')
  @Public()
  googleEnabled() {
    const enabled = !!(this.config.get<string>('google.clientId'));
    return { enabled };
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request & { user: GoogleProfile },
    @Res() res: Response,
  ) {
    const { refreshToken, ...result } = await this.authService.googleAuth(req.user);
    this.setRefreshCookie(res, refreshToken);

    const appUrl = this.config.get<string>('appUrl') ?? 'http://localhost:3000';
    const params = new URLSearchParams({
      token: result.access_token,
      slug: result.organization.slug,
    });
    res.redirect(`${appUrl}/auth/google/success?${params}`);
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      maxAge: this.refreshTokenTtlDays * 86400 * 1000,
      path: '/',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/',
    });
  }
}
