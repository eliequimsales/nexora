import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { RedisService } from '../../common/redis/redis.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string; // raw: "{userId}:{tokenId}" sent to client
  tokenId: string;
}

@Injectable()
export class TokenService {
  private readonly env: string;
  private readonly refreshTokenTtlDays: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.env = this.config.get<string>('nodeEnv') ?? 'development';
    this.refreshTokenTtlDays = this.config.get<number>('jwt.refreshTokenTtlDays') ?? 7;
  }

  async generateTokens(
    userId: string,
    orgId: string,
    role: 'admin' | 'member',
  ): Promise<TokenPair> {
    const tokenId = crypto.randomUUID();

    const accessToken = this.jwt.sign({
      sub: userId,
      orgId,
      role,
      tokenId,
    });

    const refreshToken = `${userId}:${tokenId}`;
    const hash = createHash('sha256').update(tokenId).digest('hex');
    const ttl = this.refreshTokenTtlDays * 86400;
    await this.redis.set(this.redisKey(userId, tokenId), hash, ttl);

    return { accessToken, refreshToken, tokenId };
  }

  async validateRefreshToken(userId: string, tokenId: string): Promise<boolean> {
    const stored = await this.redis.get(this.redisKey(userId, tokenId));
    if (!stored) return false;
    const expected = createHash('sha256').update(tokenId).digest('hex');
    return stored === expected;
  }

  async revokeRefreshToken(userId: string, tokenId: string): Promise<void> {
    await this.redis.del(this.redisKey(userId, tokenId));
  }

  private redisKey(userId: string, tokenId: string): string {
    return `${this.env}:rt:${userId}:${tokenId}`;
  }
}
