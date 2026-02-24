import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import http from 'http';
import express from 'express';
import cors from 'cors';

import { typeDefs } from './schema';
import { vaultResolver } from './resolvers/vaultResolver';
import { organizationResolver } from './resolvers/organizationResolver';
import { userResolver } from './resolvers/userResolver';
import { proofResolver } from './resolvers/proofResolver';
import { userResolver } from './resolvers/userResolver';
import { proofResolver } from './resolvers/proofResolver';
import { tvlResolver } from './resolvers/tvlResolver';
import { subscriptionResolver, pubsub } from './subscriptions/proofSubscription';
import { Context, authMiddleware, roleBasedAccess } from './middleware/auth';
import { adaptiveRateLimitMiddleware } from './middleware/rateLimit';

// Combine all resolvers
const resolvers = {
  Query: {
    ...organizationResolver.Query,
    ...vaultResolver.Query,
    ...userResolver.Query,
    ...proofResolver.Query,
    ...tvlResolver.Query
  },
  Mutation: {
    ...vaultResolver.Mutation,
    ...userResolver.Mutation,
    ...proofResolver.Mutation
  },
  Subscription: {
    ...subscriptionResolver.Subscription
  },
  Organization: {
    ...organizationResolver.Organization
  },
  Vault: {
    ...vaultResolver.Vault
  },
  Beneficiary: {
    ...userResolver.Beneficiary
  }
};

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export interface GraphQLContext extends Context {
  pubsub: any;
}

export class GraphQLServer {
  private apolloServer: ApolloServer<GraphQLContext>;
  private httpServer: http.Server;
  private wsServer: WebSocketServer | null = null;

  constructor(app: express.Application, httpServer: http.Server) {
    this.httpServer = httpServer;
    this.setupWebSocketServer();
    this.apolloServer = this.createApolloServer();
  }

  private setupWebSocketServer(): void {
    // Create WebSocket server for subscriptions
    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: '/graphql',
    });

    // Use the WebSocket server for GraphQL subscriptions
    useServer(
      {
        schema,
        context: async (ctx) => {
          // Extract authentication from WebSocket connection
          const user = await this.extractUserFromWebSocket(ctx);
          
          return {
            user,
            pubsub,
            req: ctx.extra.request,
            res: null
          } as GraphQLContext;
        },
      },
      this.wsServer
    );
  }

  private async extractUserFromWebSocket(ctx: any): Promise<{ address: string; role: 'user' | 'admin' } | undefined> {
    try {
      // Extract authorization from connection params
      const connectionParams = ctx.connectionParams || {};
      const authHeader = connectionParams.authorization;
      const userAddress = typeof connectionParams['x-user-address'] === 'string' 
        ? connectionParams['x-user-address'] 
        : undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // In a real implementation, verify JWT token
        if (token === 'admin-token') {
          return {
            address: '0x1234567890123456789012345678901234567890',
            role: 'admin'
          };
        }
        if (token === 'user-token') {
          return {
            address: '0x9876543210987654321098765432109876543210',
            role: 'user'
          };
        }
      }

      if (userAddress) {
        return {
          address: userAddress,
          role: 'user'
        };
      }

      return undefined;
    } catch (error) {
      console.error('Error extracting user from WebSocket:', error);
      return undefined;
    }
  }

  private createApolloServer(): ApolloServer<GraphQLContext> {
    return new ApolloServer<GraphQLContext>({
      schema,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer: this.httpServer }),
        {
          serverWillStart: async () => {
            return {
              drainServer: async () => {
                // Close WebSocket server
                if (this.wsServer) {
                  this.wsServer.close();
                }
              },
            };
          },
        },
      ],
      // Enable playground in development
      introspection: process.env.NODE_ENV !== 'production',
      // Format errors
      formatError: (formattedError, error) => {
        // Log errors for debugging
        console.error('GraphQL Error:', error);
        
        // Don't expose internal error details in production
        if (process.env.NODE_ENV === 'production') {
          return {
            message: formattedError.message,
            extensions: formattedError.extensions
          };
        }
        
        return formattedError;
      },
      // Validation rules
      validationRules: [
        // Add custom validation rules if needed
      ],
    });
  }

  // Apply middleware to Express app
  async applyMiddleware(app: express.Application): Promise<void> {
    // Apply Apollo Server middleware
    app.use(
      '/graphql',
      cors<cors.CorsRequest>(),
      express.json(),
      expressMiddleware(this.apolloServer, {
        context: async ({ req, res }): Promise<GraphQLContext> => {
          // Extract user from request
          const authHeader = req.headers.authorization;
          const userAddress = typeof req.headers['x-user-address'] === 'string' 
            ? req.headers['x-user-address'] 
            : undefined;
          
          let user: { address: string; role: 'user' | 'admin' } | undefined = undefined;
          
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            // In a real implementation, verify JWT token
            if (token === 'admin-token') {
              user = {
                address: '0x1234567890123456789012345678901234567890',
                role: 'admin'
              };
            } else if (token === 'user-token') {
              user = {
                address: '0x9876543210987654321098765432109876543210',
                role: 'user'
              };
            }
          } else if (userAddress) {
            user = {
              address: userAddress,
              role: 'user'
            };
          }

          return {
            user,
            pubsub,
            req,
            res
          };
        },
      })
    );
  }

  // Start the server
  async start(): Promise<void> {
    await this.apolloServer.start();
  }

  // Stop the server
  async stop(): Promise<void> {
    await this.apolloServer.stop();
  }

  // Get server info
  getServerInfo() {
    const port = process.env.PORT || 4000;
    return {
      graphqlEndpoint: '/graphql',
      subscriptionEndpoint: `ws://localhost:${port}/graphql`,
      playgroundUrl: `http://localhost:${port}/graphql`
    };
  }
}

// Helper function to create and configure GraphQL server
export const createGraphQLServer = async (app: express.Application): Promise<GraphQLServer> => {
  // Create HTTP server if not provided
  const httpServer = http.createServer(app);
  
  // Create GraphQL server instance
  const graphQLServer = new GraphQLServer(app, httpServer);
  
  // Start the server
  await graphQLServer.start();
  
  // Apply middleware
  await graphQLServer.applyMiddleware(app);
  
  return graphQLServer;
};

// Export the pubsub instance for use in resolvers
export { pubsub };
