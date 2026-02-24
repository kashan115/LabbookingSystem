/**
 * Application constants
 * Centralized configuration values used throughout the application
 */

// Authentication
export const BCRYPT_ROUNDS = 12;
export const TOKEN_EXPIRY_DAYS = 7;
export const JWT_MIN_LENGTH = 32;

// Rate Limiting
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 200;

// Request Body Limits
export const REQUEST_BODY_LIMIT = '10kb';

// Cache Times (milliseconds)
export const QUERY_CACHE_TIME_MS = 30_000; // 30 seconds

// Email Scheduler
export const EMAIL_DIGEST_CRON = '0 8 * * 1'; // Every Monday at 08:00 UTC
export const EMAIL_DIGEST_SCHEDULE_DESC = 'Every Monday at 08:00 UTC';

// Date Calculations
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Password Validation
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&#]{8,}$/;
export const PASSWORD_REQUIREMENTS = 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number';
