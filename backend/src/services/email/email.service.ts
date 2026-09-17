import { IEmailService } from './email.service.interface';
import { gmailEmailService } from './gmail-email.service';

export const emailService: IEmailService = gmailEmailService;
export * from './email.service.interface';
export * from './gmail-email.service';
