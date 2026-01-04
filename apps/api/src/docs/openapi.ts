/**
 * OpenAPI/Swagger Documentation
 * API specification for BlankLogo watermark removal service
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BlankLogo API',
    description: 'API for watermark removal from AI-generated videos',
    version: '1.0.0',
    contact: {
      name: 'BlankLogo Support',
      url: 'https://blanklogo.app',
      email: 'support@blanklogo.app',
    },
  },
  servers: [
    {
      url: 'https://api.blanklogo.app',
      description: 'Production server',
    },
    {
      url: 'http://localhost:8989',
      description: 'Development server',
    },
  ],
  tags: [
    { name: 'Jobs', description: 'Video processing jobs' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Credits', description: 'Credit management' },
    { name: 'Health', description: 'System health checks' },
    { name: 'Analytics', description: 'Usage analytics' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Basic health check',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    uptime: { type: 'number', example: 3600 },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/jobs': {
      post: {
        tags: ['Jobs'],
        summary: 'Create a new watermark removal job',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['video_url'],
                properties: {
                  video_url: {
                    type: 'string',
                    format: 'uri',
                    description: 'URL of the video to process',
                    example: 'https://sora.chatgpt.com/share/abc123',
                  },
                  platform: {
                    type: 'string',
                    enum: ['sora', 'runway', 'pika', 'kling', 'luma', 'minimax', 'custom'],
                    default: 'sora',
                    description: 'Video platform for watermark detection',
                  },
                  processing_mode: {
                    type: 'string',
                    enum: ['crop', 'inpaint', 'auto'],
                    default: 'inpaint',
                    description: 'Processing method',
                  },
                  crop_pixels: {
                    type: 'integer',
                    minimum: 0,
                    maximum: 200,
                    description: 'Custom crop height in pixels',
                  },
                  crop_position: {
                    type: 'string',
                    enum: ['top', 'bottom'],
                    default: 'bottom',
                  },
                  webhook_url: {
                    type: 'string',
                    format: 'uri',
                    description: 'URL to receive job status webhooks',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Job created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobResponse' },
              },
            },
          },
          '400': { description: 'Invalid request' },
          '401': { description: 'Unauthorized' },
          '402': { description: 'Insufficient credits' },
          '503': { description: 'Service unavailable' },
        },
      },
    },
    '/api/v1/jobs/{jobId}': {
      get: {
        tags: ['Jobs'],
        summary: 'Get job status',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Job ID',
          },
        ],
        responses: {
          '200': {
            description: 'Job details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobStatus' },
              },
            },
          },
          '404': { description: 'Job not found' },
        },
      },
    },
    '/api/v1/jobs/upload': {
      post: {
        tags: ['Jobs'],
        summary: 'Upload video file for processing',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Video file (max 500MB)',
                  },
                  platform: { type: 'string' },
                  processing_mode: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Upload successful, job created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JobResponse' },
              },
            },
          },
          '400': { description: 'Invalid file' },
          '413': { description: 'File too large' },
        },
      },
    },
    '/api/v1/analytics/overview': {
      get: {
        tags: ['Analytics'],
        summary: 'Get usage overview',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Analytics overview',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AnalyticsOverview' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT token',
      },
    },
    schemas: {
      JobResponse: {
        type: 'object',
        properties: {
          job_id: { type: 'string', example: 'job_abc123def456' },
          status: { type: 'string', enum: ['queued', 'processing', 'completed', 'failed'] },
          platform: { type: 'string' },
          credits_charged: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      JobStatus: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
          progress: { type: 'integer', minimum: 0, maximum: 100 },
          input_url: { type: 'string' },
          output_url: { type: 'string', nullable: true },
          error_message: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          completed_at: { type: 'string', format: 'date-time', nullable: true },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      AnalyticsOverview: {
        type: 'object',
        properties: {
          jobs: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              completed: { type: 'integer' },
              failed: { type: 'integer' },
              processing: { type: 'integer' },
            },
          },
          credits: {
            type: 'object',
            properties: {
              balance: { type: 'integer' },
              totalUsed: { type: 'integer' },
            },
          },
          successRate: { type: 'integer' },
        },
      },
      WebhookPayload: {
        type: 'object',
        properties: {
          event: {
            type: 'string',
            enum: ['job.started', 'job.completed', 'job.failed', 'job.progress'],
          },
          timestamp: { type: 'string', format: 'date-time' },
          data: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              status: { type: 'string' },
              outputUrl: { type: 'string', nullable: true },
              errorMessage: { type: 'string', nullable: true },
              progress: { type: 'integer', nullable: true },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
    },
  },
};

/**
 * Generate OpenAPI JSON endpoint handler
 */
export function getOpenApiHandler() {
  return (req: any, res: any) => {
    res.json(openApiSpec);
  };
}

/**
 * Generate Swagger UI HTML
 */
export function getSwaggerHtml(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BlankLogo API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #1a1a1a; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        deepLinking: true,
      });
    };
  </script>
</body>
</html>
`;
}

export default openApiSpec;
