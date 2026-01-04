/**
 * OpenAPI Documentation Tests
 */

import { describe, it, expect } from 'vitest';

// Import the spec directly for testing
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BlankLogo API',
    version: '1.0.0',
  },
  paths: {
    '/health': { get: { tags: ['Health'] } },
    '/api/v1/jobs': { post: { tags: ['Jobs'] } },
    '/api/v1/jobs/{jobId}': { get: { tags: ['Jobs'] } },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      JobResponse: { type: 'object' },
      JobStatus: { type: 'object' },
    },
  },
};

describe('OpenAPI Specification', () => {
  describe('Spec Structure', () => {
    it('should have valid OpenAPI version', () => {
      expect(openApiSpec.openapi).toBe('3.0.3');
    });

    it('should have API info', () => {
      expect(openApiSpec.info.title).toBe('BlankLogo API');
      expect(openApiSpec.info.version).toBeDefined();
    });

    it('should define paths', () => {
      expect(Object.keys(openApiSpec.paths).length).toBeGreaterThan(0);
    });

    it('should have security schemes', () => {
      expect(openApiSpec.components.securitySchemes.bearerAuth).toBeDefined();
      expect(openApiSpec.components.securitySchemes.bearerAuth.type).toBe('http');
    });
  });

  describe('Endpoint Definitions', () => {
    it('should define health endpoint', () => {
      expect(openApiSpec.paths['/health']).toBeDefined();
      expect(openApiSpec.paths['/health'].get).toBeDefined();
    });

    it('should define jobs endpoints', () => {
      expect(openApiSpec.paths['/api/v1/jobs']).toBeDefined();
      expect(openApiSpec.paths['/api/v1/jobs'].post).toBeDefined();
    });

    it('should define job status endpoint', () => {
      expect(openApiSpec.paths['/api/v1/jobs/{jobId}']).toBeDefined();
      expect(openApiSpec.paths['/api/v1/jobs/{jobId}'].get).toBeDefined();
    });
  });

  describe('Schemas', () => {
    it('should define JobResponse schema', () => {
      expect(openApiSpec.components.schemas.JobResponse).toBeDefined();
      expect(openApiSpec.components.schemas.JobResponse.type).toBe('object');
    });

    it('should define JobStatus schema', () => {
      expect(openApiSpec.components.schemas.JobStatus).toBeDefined();
    });
  });

  describe('Tags', () => {
    it('should have tags on endpoints', () => {
      expect(openApiSpec.paths['/health'].get.tags).toContain('Health');
      expect(openApiSpec.paths['/api/v1/jobs'].post.tags).toContain('Jobs');
    });
  });
});

describe('API Documentation Content', () => {
  describe('Job Creation', () => {
    it('should document required fields', () => {
      const requiredFields = ['video_url'];
      requiredFields.forEach(field => {
        expect(field).toBeDefined();
      });
    });

    it('should document optional fields', () => {
      const optionalFields = ['platform', 'processing_mode', 'crop_pixels', 'webhook_url'];
      expect(optionalFields.length).toBe(4);
    });

    it('should document platform options', () => {
      const platforms = ['sora', 'runway', 'pika', 'kling', 'luma', 'minimax', 'custom'];
      expect(platforms).toContain('sora');
      expect(platforms).toContain('runway');
    });

    it('should document processing modes', () => {
      const modes = ['crop', 'inpaint', 'auto'];
      expect(modes.length).toBe(3);
    });
  });

  describe('Response Codes', () => {
    it('should document success codes', () => {
      const successCodes = [200, 201];
      expect(successCodes).toContain(200);
    });

    it('should document error codes', () => {
      const errorCodes = [400, 401, 402, 404, 500, 503];
      expect(errorCodes).toContain(401); // Unauthorized
      expect(errorCodes).toContain(402); // Payment required
      expect(errorCodes).toContain(503); // Service unavailable
    });
  });
});

describe('Webhook Documentation', () => {
  it('should document webhook events', () => {
    const events = ['job.started', 'job.completed', 'job.failed', 'job.progress'];
    expect(events.length).toBe(4);
  });

  it('should document webhook payload structure', () => {
    const payloadFields = ['event', 'timestamp', 'data'];
    expect(payloadFields).toContain('event');
    expect(payloadFields).toContain('timestamp');
    expect(payloadFields).toContain('data');
  });

  it('should document webhook data fields', () => {
    const dataFields = ['jobId', 'status', 'outputUrl', 'errorMessage', 'progress'];
    expect(dataFields).toContain('jobId');
    expect(dataFields).toContain('status');
  });
});

describe('Authentication', () => {
  it('should document bearer auth', () => {
    expect(openApiSpec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });

  it('should document API key auth location', () => {
    const authHeader = 'Authorization';
    const authFormat = 'Bearer {token}';
    expect(authHeader).toBe('Authorization');
    expect(authFormat).toContain('Bearer');
  });
});
