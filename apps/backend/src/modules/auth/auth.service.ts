import bcrypt from 'bcrypt';
import { loadConfig } from '@kdp/config';
import type { LoginInput, RegisterInput, UserDto } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { UserModel, type UserDocument } from './user.model.js';
import { SessionModel } from './session.model.js';
import { generateRefreshToken, hashToken, signAccessToken } from './token.util.js';

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface RequestMeta {
  userAgent: string;
  ip: string;
}

function toUserDto(user: UserDocument): UserDto {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role as UserDto['role'],
    organizationId: user.organizationId ? user.organizationId.toString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

async function issueSession(user: UserDocument, meta: RequestMeta): Promise<IssuedTokens> {
  const config = loadConfig();
  const rawRefreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session = await SessionModel.create({
    userId: user._id,
    tokenHash: hashToken(rawRefreshToken),
    userAgent: meta.userAgent,
    ip: meta.ip,
    expiresAt: refreshTokenExpiresAt,
  });

  const { token: accessToken, expiresAt: accessTokenExpiresAt } = signAccessToken({
    sub: user._id.toString(),
    role: user.role as 'admin' | 'user',
    sid: session._id.toString(),
  });

  return { accessToken, accessTokenExpiresAt, refreshToken: rawRefreshToken, refreshTokenExpiresAt };
}

export const authService = {
  async register(input: RegisterInput, meta: RequestMeta): Promise<{ user: UserDto; tokens: IssuedTokens }> {
    const existing = await UserModel.findOne({ email: input.email }).lean();
    if (existing) {
      throw new AppError('EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.', 409);
    }
    const config = loadConfig();
    const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_COST);
    const user = await UserModel.create({ email: input.email, passwordHash, name: input.name, role: 'user' });
    const tokens = await issueSession(user, meta);
    return { user: toUserDto(user), tokens };
  },

  async login(input: LoginInput, meta: RequestMeta): Promise<{ user: UserDto; tokens: IssuedTokens }> {
    const user = await UserModel.findOne({ email: input.email });
    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }
    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }
    if (user.disabled) {
      throw AppError.forbidden('This account has been disabled.');
    }
    const tokens = await issueSession(user, meta);
    return { user: toUserDto(user), tokens };
  },

  /** Verifies + rotates a refresh token: the old session is revoked and a new one issued, mitigating replay of a stolen cookie. */
  async refresh(rawRefreshToken: string, meta: RequestMeta): Promise<{ user: UserDto; tokens: IssuedTokens }> {
    const tokenHash = hashToken(rawRefreshToken);
    const session = await SessionModel.findOne({ tokenHash });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Session expired or revoked. Please log in again.', 401);
    }
    const user = await UserModel.findById(session.userId);
    if (!user) {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Session expired or revoked. Please log in again.', 401);
    }
    if (user.disabled) {
      session.revokedAt = new Date();
      await session.save();
      throw AppError.forbidden('This account has been disabled.');
    }

    session.revokedAt = new Date();
    await session.save();

    const tokens = await issueSession(user, meta);
    return { user: toUserDto(user), tokens };
  },

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await SessionModel.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
  },

  async getById(userId: string): Promise<UserDto> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return toUserDto(user);
  },
};
