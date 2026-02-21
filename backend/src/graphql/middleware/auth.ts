import { GraphQLResolveInfo } from 'graphql';

export interface Context {
  user?: {
    address: string;
    role: 'admin' | 'user';
  };
  req: any;
  res: any;
}

export interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  allowedOperations?: string[];
}

// Mock user database - in a real implementation, this would connect to your user system
const MOCK_USERS = {
  '0x1234567890123456789012345678901234567890': {
    address: '0x1234567890123456789012345678901234567890',
    role: 'admin'
  },
  '0x9876543210987654321098765432109876543210': {
    address: '0x9876543210987654321098765432109876543210',
    role: 'user'
  }
};

// Extract user from request headers
const extractUserFromRequest = (req: any) => {
  // Try to get user from Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // In a real implementation, you would verify the JWT token
    // For now, we'll use a simple mapping
    if (token === 'admin-token') {
      return MOCK_USERS['0x1234567890123456789012345678901234567890'];
    }
    if (token === 'user-token') {
      return MOCK_USERS['0x9876543210987654321098765432109876543210'];
    }
  }

  // Try to get user from x-user-address header
  const userAddress = req.headers['x-user-address'];
  if (userAddress) {
    return MOCK_USERS[userAddress as string] || {
      address: userAddress,
      role: 'user'
    };
  }

  return null;
};

// Authentication middleware
export const authMiddleware = (options: AuthMiddlewareOptions = {}) => {
  return async (
    resolve: any,
    parent: any,
    args: any,
    context: Context,
    info: GraphQLResolveInfo
  ) => {
    const { requireAuth = false, requireAdmin = false, allowedOperations = [] } = options;

    // Extract user from context/request
    const user = context.user || extractUserFromRequest(context.req);

    // Update context with user
    context.user = user;

    // Check if authentication is required
    if (requireAuth && !user) {
      throw new Error('Authentication required. Please provide valid credentials.');
    }

    // Check if admin access is required
    if (requireAdmin && (!user || user.role !== 'admin')) {
      throw new Error('Admin access required for this operation.');
    }

    // Check if operation is allowed for this user
    if (allowedOperations.length > 0 && user) {
      const operationName = info.operation.operation === 'mutation' 
        ? info.fieldName 
        : `${info.operation.operation}.${info.fieldName}`;
      
      const isAllowed = allowedOperations.some(allowedOp => 
        operationName.includes(allowedOp)
      );

      if (!isAllowed && user.role !== 'admin') {
        throw new Error(`Operation '${operationName}' is not allowed for your role.`);
      }
    }

    // Add user context to args for resolvers
    args.user = user;

    return resolve(parent, args, context, info);
  };
};

// Role-based access control middleware
export const roleBasedAccess = {
  // Public operations (no auth required)
  public: authMiddleware({ requireAuth: false }),

  // User operations (auth required)
  user: authMiddleware({ requireAuth: true }),

  // Admin operations (admin auth required)
  admin: authMiddleware({ requireAuth: true, requireAdmin: true }),

  // Self-service operations (users can only access their own data)
  selfService: authMiddleware({ 
    requireAuth: true,
    allowedOperations: ['beneficiary', 'withdraw', 'claims']
  }),

  // Read-only operations
  readOnly: authMiddleware({ 
    requireAuth: false,
    allowedOperations: ['Query']
  })
};

// Helper function to check if user can access vault
export const canAccessVault = async (userAddress: string | undefined, vaultAddress: string) => {
  if (!userAddress) {
    return false;
  }

  try {
    // In a real implementation, you would check if the user is:
    // 1. The vault owner
    // 2. A beneficiary of the vault
    // 3. An admin

    const { models } = require('../../models');
    
    // Check if user is vault owner
    const vault = await models.Vault.findOne({
      where: { 
        address: vaultAddress,
        owner_address: userAddress
      }
    });

    if (vault) {
      return { canAccess: true, role: 'owner' };
    }

    // Check if user is beneficiary
    const beneficiary = await models.Beneficiary.findOne({
      where: { address: userAddress },
      include: [
        {
          model: models.Vault,
          as: 'vault',
          where: { address: vaultAddress }
        }
      ]
    });

    if (beneficiary) {
      return { canAccess: true, role: 'beneficiary' };
    }

    // Check if user is admin
    const user = MOCK_USERS[userAddress as keyof typeof MOCK_USERS];
    if (user && user.role === 'admin') {
      return { canAccess: true, role: 'admin' };
    }

    return { canAccess: false, role: null };
  } catch (error) {
    console.error('Error checking vault access:', error);
    return { canAccess: false, role: null };
  }
};

// Middleware to check vault access
export const vaultAccessMiddleware = async (
  resolve: any,
  parent: any,
  args: any,
  context: Context,
  info: GraphQLResolveInfo
) => {
  const user = context.user;
  
  if (!user) {
    throw new Error('Authentication required to access vault data.');
  }

  // Extract vault address from args based on the operation
  let vaultAddress = null;
  
  if (args.address) {
    vaultAddress = args.address;
  } else if (args.vaultAddress) {
    vaultAddress = args.vaultAddress;
  } else if (args.input?.vaultAddress) {
    vaultAddress = args.input.vaultAddress;
  }

  if (vaultAddress) {
    const access = await canAccessVault(user.address, vaultAddress);
    
    if (!access.canAccess) {
      throw new Error('Access denied. You do not have permission to access this vault.');
    }

    // Add access role to context
    context.vaultAccessRole = access.role;
  }

  return resolve(parent, args, context, info);
};

// Rate limiting based on user role
export const getRateLimitForUser = (user: any) => {
  if (!user) {
    return 10; // Very low limit for unauthenticated users
  }

  switch (user.role) {
    case 'admin':
      return 1000; // High limit for admins
    case 'user':
      return 100;  // Standard limit for users
    default:
      return 50;   // Default limit
  }
};
