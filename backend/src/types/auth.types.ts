import { Role } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  activatedAt: Date | null;
}

export interface UserResponseDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
  activatedAt: Date | null;
  isActive?: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
  studentProfile?: {
    studentNumber: string;
  } | null;
}

export interface UpdateProfileInput {
  name: string;
}

export interface AdminUserListItemDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  activatedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  studentProfile?: {
    studentNumber: string;
  } | null;
}

export interface AdminUserDetailDTO extends AdminUserListItemDTO {
  updatedAt: Date;
}

export interface AdminUpdateUserInput {
  name?: string;
  email?: string;
  studentNumber?: string;
  isActive?: boolean;
}

export interface LoginResponseData {
  user: UserResponseDTO;
  token: string;
  rawRefreshToken?: string;
}

export interface ActivateAccountResponseData {
  message: string;
  user: UserResponseDTO;
  token: string;
  rawRefreshToken?: string;
}

export interface ChangePasswordResponseData {
  message: string;
  token?: string;
  rawRefreshToken?: string;
}

export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
