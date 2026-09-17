export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive?: boolean;
  mustChangePassword: boolean;
  activatedAt: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  studentProfile?: {
    studentNumber: string;
  } | null;
}

export interface UpdateProfileResponseData {
  user: AuthUser;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  activatedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  studentProfile?: {
    studentNumber: string;
  } | null;
}

export interface AdminUserDetail extends AdminUserListItem {
  updatedAt: string;
}

export interface AdminUpdateUserInput {
  name?: string;
  email?: string;
  studentNumber?: string;
  isActive?: boolean;
}

export interface AdminCreateUserInput {
  role: UserRole;
  name: string;
  email: string;
  studentNumber?: string;
}

export interface AdminResetAccessResponse {
  message: string;
  emailSent: boolean;
}

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export interface LoginResponseData {
  token: string;
  user: AuthUser;
}

export interface RefreshResponseData {
  token: string;
  user: AuthUser;
}

export interface GetMeResponseData {
  user: AuthUser;
}

export interface ActivateValidateResponseData {
  valid: boolean;
}

export interface ActivateAccountResponseData {
  message: string;
  user: AuthUser;
  token: string;
}

export interface ResetValidateResponseData {
  valid: boolean;
}

export interface ResetPasswordResponseData {
  message: string;
  user: AuthUser;
  token: string;
}

export interface ChangePasswordResponseData {
  message: string;
  token: string;
}

export interface LogoutResponseData {
  message: string;
}
