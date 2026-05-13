import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { TenantContext } from '../../../common/tenant/tenant-context';

interface JwtPayload {
  sub: string;
  orgId: string;
  role: 'admin' | 'member';
  tokenId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret')!,
    });
  }

  validate(payload: JwtPayload): TenantContext {
    return {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      tokenId: payload.tokenId,
    };
  }
}
