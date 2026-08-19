import { loadConfig } from '@kdp/config';
import { listRules } from '@kdp/kdp-validator';
import type { AdminUserDto, SystemInfoDto, UpdateUserInput, ValidationRuleDto } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { UserModel, type UserDocument } from '../auth/user.model.js';
import { ProjectModel } from '../projects/project.model.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';

async function toAdminUserDto(user: UserDocument): Promise<AdminUserDto> {
  const projectCount = await ProjectModel.countDocuments({ userId: user._id, deletedAt: null });
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role as AdminUserDto['role'],
    disabled: user.disabled,
    projectCount,
    createdAt: user.createdAt.toISOString(),
  };
}

export const adminService = {
  async listUsers(): Promise<AdminUserDto[]> {
    const users = await UserModel.find().sort({ createdAt: -1 });
    return Promise.all(users.map(toAdminUserDto));
  },

  async updateUser(callerId: string, targetUserId: string, input: UpdateUserInput): Promise<AdminUserDto> {
    if (callerId === targetUserId && (input.role === 'user' || input.disabled === true)) {
      throw AppError.validation('You cannot remove your own admin access or disable your own account.');
    }
    const user = await UserModel.findById(targetUserId);
    if (!user) {
      throw AppError.notFound('User not found.');
    }
    Object.assign(user, input);
    await user.save();
    return toAdminUserDto(user);
  },

  getValidationRules(): ValidationRuleDto[] {
    return listRules().map((rule) => ({ id: rule.id, label: rule.label, category: rule.category }));
  },

  async getSystemInfo(): Promise<SystemInfoDto> {
    const config = loadConfig();
    const aiUsage = await aiUsageService.getGlobalSummary();
    return {
      nodeEnv: config.NODE_ENV,
      aiProvider: config.AI_PROVIDER,
      imageProvider: config.IMAGE_PROVIDER,
      storageProvider: config.STORAGE_PROVIDER,
      aiUsage,
    };
  },
};
