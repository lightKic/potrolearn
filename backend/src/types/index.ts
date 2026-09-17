/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./express.d.ts" />

export * from './auth.types';
export * from './content.types';
export * from './student-import.types';
export * from './assessment.types';

export interface ApiResponse<T = unknown> {
  status: string;
  data?: T;
  message?: string;
}
