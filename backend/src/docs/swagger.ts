import type { Express, Request, Response } from 'express'
import swaggerJSDoc, { Options } from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

const apiVersion = process.env.npm_package_version ?? '1.0.0'

function csvEnv(name: string, fallback: string[]) {
  const values = (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return values.length ? values : fallback
}

// The OpenAPI document is composed from this base definition plus JSDoc route
// annotations in src/modules. Keep shared schemas here so route docs stay small.
export const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ProofChain Web3 Freelance Platform API',
      version: apiVersion,
      description:
        'Production API for ProofChain, covering wallet authentication, projects, milestones, submissions, escrow payments, notifications, profile management, realtime events, and NFT certificates.',
      contact: {
        name: 'ProofChain API Support',
      },
    },
    servers: csvEnv('OPENAPI_SERVER_URLS', [
      `http://localhost:${process.env.PORT ?? 5000}`,
      'https://api.proofchain.example.com',
    ]).map((url) => ({
      url,
      description: url.includes('localhost') ? 'Local development server' : 'Production server',
    })),
    tags: [
      { name: 'Auth', description: 'Wallet authentication, JWT sessions, and wallet linking' },
      { name: 'Profile', description: 'Authenticated and public user profile management' },
      { name: 'Projects', description: 'Freelance project lifecycle and invitations' },
      { name: 'Milestones', description: 'Milestone planning, review state, and lifecycle tracking' },
      { name: 'Submissions', description: 'Milestone submissions and deliverable uploads' },
      { name: 'Payments', description: 'Escrow payment and blockchain transaction operations' },
      { name: 'Notifications', description: 'User notifications and unread state' },
      { name: 'Realtime', description: 'Socket.IO event contracts emitted by the backend' },
      { name: 'NFT Certificates', description: 'Soulbound NFT certificate minting and metadata' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste an access token from /api/auth/verify or /api/auth/refresh.',
        },
      },
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'walletAddress', 'role', 'createdAt'],
          properties: {
            id: { type: 'string', format: 'uuid', example: '5b827f08-4a8b-4d1a-bf8b-e6dc3ea4e3f7' },
            walletAddress: { type: 'string', example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
            role: { type: 'string', enum: ['CLIENT', 'FREELANCER', 'ADMIN'], example: 'FREELANCER' },
            username: { type: 'string', nullable: true, example: 'satoshi-builder' },
            bio: { type: 'string', nullable: true, example: 'Full-stack Web3 engineer focused on escrow workflows.' },
            avatarUrl: { type: 'string', nullable: true, format: 'uri', example: 'https://cdn.example.com/avatar.png' },
            githubUrl: { type: 'string', nullable: true, format: 'uri', example: 'https://github.com/proofchain-dev' },
            linkedinUrl: { type: 'string', nullable: true, format: 'uri' },
            portfolioUrl: { type: 'string', nullable: true, format: 'uri', example: 'https://proofchain.dev' },
            skills: { type: 'array', items: { type: 'string' }, example: ['Solidity', 'TypeScript', 'Node.js'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Milestone: {
          type: 'object',
          required: ['id', 'projectId', 'title', 'amount', 'status'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            title: { type: 'string', example: 'Smart contract escrow implementation' },
            description: { type: 'string', nullable: true, example: 'Implement and test escrow release flows.' },
            amount: { type: 'number', format: 'float', example: 1250 },
            status: { type: 'string', example: 'pending' },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          required: ['id', 'title', 'budget', 'status', 'ownerId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string', example: 'Decentralized escrow dashboard' },
            description: { type: 'string', nullable: true, example: 'Build a milestone-based Web3 freelance dashboard.' },
            budget: { type: 'number', format: 'float', example: 5000 },
            status: {
              type: 'string',
              enum: ['draft', 'open', 'invited', 'in_progress', 'submitted', 'approved', 'completed', 'rejected', 'disputed', 'cancelled'],
              example: 'open',
            },
            deadline: { type: 'string', format: 'date-time', nullable: true },
            ownerId: { type: 'string', format: 'uuid' },
            freelancerId: { type: 'string', format: 'uuid', nullable: true },
            invitedFreelancerId: { type: 'string', format: 'uuid', nullable: true },
            milestones: { type: 'array', items: { $ref: '#/components/schemas/Milestone' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Submission: {
          type: 'object',
          required: ['id', 'milestoneId', 'submittedById'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            milestoneId: { type: 'string', format: 'uuid' },
            submittedById: { type: 'string', format: 'uuid' },
            githubLink: { type: 'string', format: 'uri', nullable: true, example: 'https://github.com/acme/escrow' },
            demoLink: { type: 'string', format: 'uri', nullable: true, example: 'https://demo.example.com' },
            remarks: { type: 'string', nullable: true, example: 'Ready for review.' },
            ipfsCid: { type: 'string', nullable: true, example: 'bafybeigdyrzt...' },
            gatewayUrl: { type: 'string', format: 'uri', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UploadSubmissionResponse: {
          allOf: [
            { $ref: '#/components/schemas/SuccessResponse' },
            {
              type: 'object',
              required: ['success', 'message', 'data'],
              properties: {
                message: { type: 'string', example: 'Upload successful' },
                data: {
                  type: 'object',
                  required: ['submission', 'ipfsCid', 'gatewayUrl'],
                  properties: {
                    submission: { $ref: '#/components/schemas/Submission' },
                    ipfsCid: { type: 'string', example: 'bafybeigdyrzt5examplecid' },
                    gatewayUrl: {
                      type: 'string',
                      format: 'uri',
                      example: 'https://gateway.pinata.cloud/ipfs/bafybeigdyrzt5examplecid',
                    },
                  },
                },
              },
            },
          ],
        },
        Payment: {
          type: 'object',
          required: ['id', 'projectId', 'payerId', 'payeeId', 'amount', 'type', 'status'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            milestoneId: { type: 'string', format: 'uuid', nullable: true },
            submissionId: { type: 'string', format: 'uuid', nullable: true },
            payerId: { type: 'string', format: 'uuid' },
            payeeId: { type: 'string', format: 'uuid' },
            amount: { type: 'number', format: 'float', example: 1250 },
            currency: { type: 'string', example: 'USDC' },
            type: { type: 'string', enum: ['escrow_deposit', 'milestone_release', 'refund'], example: 'milestone_release' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'released', 'refunded'], example: 'pending' },
            escrowAddress: { type: 'string', nullable: true, example: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' },
            failureReason: { type: 'string', nullable: true },
            metadata: { type: 'object', additionalProperties: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          required: ['id', 'userId', 'type', 'title', 'message', 'read'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            type: { type: 'string', example: 'payment_completed' },
            title: { type: 'string', example: 'Payment completed' },
            message: { type: 'string', example: 'A payment was completed for your project.' },
            read: { type: 'boolean', example: false },
            metadata: { type: 'object', additionalProperties: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        SuccessResponse: {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation completed successfully' },
            data: { nullable: true, description: 'Endpoint-specific payload.' },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['success', 'message', 'code'],
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Authentication token is required' },
            code: { type: 'string', example: 'AUTH_TOKEN_REQUIRED' },
            requestId: { type: 'string', example: 'f2ebf9ac-6290-4f4b-93e3-fac6f8a79123' },
          },
        },
        ValidationErrorResponse: {
          allOf: [
            { $ref: '#/components/schemas/ErrorResponse' },
            {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      path: { type: 'string', example: 'body.walletAddress' },
                      message: { type: 'string', example: 'Invalid Ethereum wallet address' },
                    },
                  },
                },
              },
            },
          ],
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing, invalid, or expired JWT access token.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: 'Authentication token is required', code: 'AUTH_TOKEN_REQUIRED' },
            },
          },
        },
        Forbidden: {
          description: 'Authenticated user does not have permission for this resource.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: 'You do not have permission to access this resource', code: 'FORBIDDEN' },
            },
          },
        },
        NotFound: {
          description: 'Resource was not found.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: 'Resource not found', code: 'RESOURCE_NOT_FOUND' },
            },
          },
        },
        ValidationError: {
          description: 'Request payload, params, or query validation failed.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        RateLimited: {
          description: 'Too many requests.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { success: false, message: 'Too many requests. Please try again later.', code: 'RATE_LIMIT_EXCEEDED' },
            },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.ts'],
}

export const swaggerSpec = swaggerJSDoc(swaggerOptions)

export function setupSwaggerDocs(app: Express) {
  // Keep docs mounted before API routes and error handlers so the generated
  // OpenAPI contract remains browsable even when protected routes require JWTs.
  const swaggerUiHandler = swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: 'ProofChain API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  })

  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json(swaggerSpec)
  })

  // Swagger UI emits relative asset URLs. Redirect the extensionless docs URL
  // to a trailing-slash path so browsers request assets from /api/docs/*.
  app.get(/^\/api\/docs$/, (_req: Request, res: Response) => res.redirect(301, '/api/docs/'))
  app.use('/api/docs', swaggerUi.serve)
  app.get('/api/docs/', swaggerUiHandler)
}
