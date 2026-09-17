export interface AccountInvitationEmailInput {
  recipientEmail: string;
  recipientName: string;
  courseName?: string;
  rawToken: string;
  temporaryPassword: string;
}

export interface PasswordResetEmailInput {
  recipientEmail: string;
  recipientName: string;
  rawToken: string;
  temporaryPassword: string;
}

export interface IEmailService {
  sendAccountInvitation(input: AccountInvitationEmailInput): Promise<boolean>;
  sendPasswordReset(input: PasswordResetEmailInput): Promise<boolean>;
  verifyConnection(): Promise<boolean>;
}
