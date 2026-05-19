import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('google.clientId') || 'disabled';
    const clientSecret = config.get<string>('google.clientSecret') || 'disabled';
    const callbackURL = config.get<string>('google.callbackUrl') || 'http://localhost:3001/api/v1/auth/google/callback';
    super({ clientID, clientSecret, callbackURL, scope: ['email', 'profile'] });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: { id: string; emails: Array<{ value: string }>; displayName: string; photos?: Array<{ value: string }> },
    done: VerifyCallback,
  ) {
    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value,
    };
    done(null, googleProfile);
  }
}
