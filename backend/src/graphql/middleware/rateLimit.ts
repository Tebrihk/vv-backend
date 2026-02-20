import rateLimit from 'express-rate-limit';
import { Context } from './auth';

// In-memory store for rate limiting (in production, use Redis or similar)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Rate limiting configurations for different user roles
const RATE_LIMIT_CONFIGS = {
  unauthenticated: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window
    message: 'Too many requests from unauthenticated users. Please authenticate to increase limits.'
  },
  user: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window
    message: 'Rate limit exceeded for user. Please try again later.'
  },
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    message: 'Rate limit exceeded for admin. Please try again later.'
  }
};

// GraphQL-specific rate limiting middleware
export const graphqlRateLimitMiddleware = (options: { 
  windowMs?: number; 
  max?: number; 
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
} = {}) => {
  return async (
    resolve: any,
    parent: any,
    args: any,
    context: Context,
    info: any
  ) => {
    const user = context.user;
    const req = context.req;

    // Get client identifier
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAddress = user?.address || 'anonymous';
    const identifier = `${clientIp}:${userAddress}`;

    // Determine rate limit config based on user role
    let config;
    if (!user) {
      config = RATE_LIMIT_CONFIGS.unauthenticated;
    } else if (user.role === 'admin') {
      config = RATE_LIMIT_CONFIGS.admin;
    } else {
      config = RATE_LIMIT_CONFIGS.user;
    }

    // Override with provided options
    const windowMs = options.windowMs || config.windowMs;
    const maxRequests = options.max || config.max;
    const message = options.message || config.message;

    // Get current request count
    const now = Date.now();
    const current = requestCounts.get(identifier);

    if (!current || now > current.resetTime) {
      // Reset or initialize counter
      requestCounts.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
    } else {
      // Increment counter
      current.count++;
      
      // Check if rate limit exceeded
      if (current.count > maxRequests) {
        const error = new Error(message);
        (error as any).extensions = {
          code: 'RATE_LIMIT_EXCEEDED',
          rateLimitInfo: {
            limit: maxRequests,
            current: current.count,
            resetTime: new Date(current.resetTime).toISOString(),
            windowMs
          }
        };
        throw error;
      }
    }

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to clean up
      for (const [key, value] of requestCounts.entries()) {
        if (now > value.resetTime) {
          requestCounts.delete(key);
        }
      }
    }

    return resolve(parent, args, context, info);
  };
};

// Operation-specific rate limiting
export const operationRateLimit = {
  // Strict rate limiting for expensive operations
  strict: graphqlRateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: 'Rate limit exceeded for this operation. Please try again later.'
  }),

  // Moderate rate limiting for standard operations
  moderate: graphqlRateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Rate limit exceeded for this operation. Please try again later.'
  }),

  // Lenient rate limiting for read operations
  lenient: graphqlRateLimitMiddleware({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per window
    message: 'Rate limit exceeded for this operation. Please try again later.'
  })
};

// Express rate limiter for HTTP endpoints (including GraphQL endpoint)
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
} = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // 100 requests per window
    message: options.message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: (req) => {
      // Use user address if available, otherwise IP
      const userAddress = req.headers['x-user-address'];
      const authHeader = req.headers.authorization;
      
      if (userAddress) {
        return `user:${userAddress}`;
      }
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // In a real implementation, you'd decode the JWT to get user ID
        return `token:${authHeader.substring(7).substring(0, 10)}`;
      }
      
      return `ip:${req.ip}`;
    },
    handler: (req, res) => {
      const userAddress = req.headers['x-user-address'];
      const isUser = !!userAddress;
      
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: options.message || 'Too many requests, please try again later.',
        rateLimitInfo: {
          limit: options.max || 100,
          windowMs: options.windowMs || 15 * 60 * 1000,
          userType: isUser ? 'authenticated' : 'anonymous',
          retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000)
        }
      });
    }
  });
};

// Rate limiting for different operation types
export const getRateLimitForOperation = (operationName: string, operationType: string) => {
  // Expensive operations
  const expensiveOperations = [
    'processBatchClaims',
    'backfillMissingPrices',
    'createVault',
    'topUpVault'
  ];

  // Moderate operations
  const moderateOperations = [
    'withdraw',
    'processClaim',
    'transferVault',
    'revokeAccess'
  ];

  // Read operations are typically less restrictive
  if (operationType === 'query') {
    return operationRateLimit.lenient;
  }

  if (expensiveOperations.includes(operationName)) {
    return operationRateLimit.strict;
  }

  if (moderateOperations.includes(operationName)) {
    return operationRateLimit.moderate;
  }

  return operationRateLimit.moderate;
};

// Middleware that applies rate limiting based on operation
export const adaptiveRateLimitMiddleware = async (
  resolve: any,
  parent: any,
  args: any,
  context: Context,
  info: any
) => {
  const operationName = info.fieldName;
  const operationType = info.operation.operation;
  
  const rateLimitMiddleware = getRateLimitForOperation(operationName, operationType);
  
  return rateLimitMiddleware(resolve, parent, args, context, info);
};

// Export rate limiter for Express
export { createRateLimiter as rateLimiter };
