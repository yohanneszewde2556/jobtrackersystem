import { Request } from 'express';

// Database user entity
export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at: Date;
}

// Payload embedded in JWT token
export interface JwtPayload {
  userId: string;
  email: string;
}

// Extended Express Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Request body for user registration
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

// Request body for user login
export interface LoginRequest {
  email: string;
  password: string;
}

// API response structure
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// JWT token response
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// Database row type (what pg returns)
export interface UserRow {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at: Date;
}

// Valid application statuses
export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'offer' | 'rejected';

// Application entity
export interface Application {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  job_url: string | null;
  date_applied: string | null;
  interview_date: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// Database row for application
export interface ApplicationRow {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  job_url: string | null;
  date_applied: string | null;
  interview_date: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// Request body for creating an application
export interface CreateApplicationRequest {
  company: string;
  role: string;
  status?: ApplicationStatus;
  job_url?: string;
  date_applied?: string;
  interview_date?: string;
  notes?: string;
}

// Request body for updating an application
export interface UpdateApplicationRequest {
  company?: string;
  role?: string;
  status?: ApplicationStatus;
  job_url?: string;
  date_applied?: string;
  interview_date?: string;
  notes?: string;
}

// Stats response
export interface ApplicationStats {
  total: number;
  by_status: Record<ApplicationStatus, number>;
  response_rate: number;
}