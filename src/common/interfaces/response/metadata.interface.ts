export interface Metadata {
  resource?: ResourceMetadata;
  performance?: PerformanceMetadata;
  rateLimit?: RateLimitMetadata;
  request?: RequestMetadata;
}

export interface ResourceMetadata {
  count?: number;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface PerformanceMetadata {
  executionTimeMs: number;
  serverTimeMs: number;
}

export interface RateLimitMetadata {
  limit: number;
  remaining: number;
  reset: number;
}

export interface RequestMetadata {
  requestId: string;
  originIp: string;
  userAgent?: string;
}
