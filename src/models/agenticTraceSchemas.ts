import { z } from 'zod';

// Agent types enum - only include actually implemented agents
export const AgentTypeSchema = z.enum([
  'coordinator',
  'linear',
]);

// UUID validation
const UuidSchema = z.string().uuid();

// ISO datetime validation  
const DateTimeSchema = z.string().datetime();

// Agent Event schema - simplified structure
export const AgentEventSchema = z.object({
  id: UuidSchema,
  type: z.enum(['tool', 'start', 'handoff']),
  agent: AgentTypeSchema,
  input: z.record(z.unknown()),
  output: z.record(z.unknown()),
  markdown: z.string().optional(),
  timestamp: DateTimeSchema,
});

// Agentic Trace schema
export const AgenticTraceSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(255),
  initialInput: z.string().min(1),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  duration: z.number().min(0).optional(), // milliseconds
  events: z.array(AgentEventSchema).default([]),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  agentHint: AgentTypeSchema.optional(),
});

// API Request schemas

// Create trace request
export const CreateTraceRequestSchema = z.object({
  name: z.string().min(1).max(255),
  input: z.string().min(1),
  firstAgent: AgentTypeSchema.optional(),
  blocking: z.boolean().default(true),
  agentHint: AgentTypeSchema.optional(),
});

// Update trace request (for adding events)
export const AddEventRequestSchema = z.object({
  traceId: UuidSchema,
  event: AgentEventSchema.omit({ id: true }),
});

// Pagination schema
export const PaginationRequestSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  orderBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).default('desc'),
});

// Field selection schema
export const FieldsSchema = z.object({
  fields: z.string().optional(), // comma-separated list of fields to include
});

// List traces request
export const ListTracesRequestSchema = PaginationRequestSchema.extend({
  fields: z.string().optional(), // comma-separated list of fields to include
});

// Get trace request
export const GetTraceRequestSchema = z.object({
  id: UuidSchema,
  fields: z.string().optional(), // comma-separated list of fields to include
});

// Response schemas
export const PaginationResponseSchema = z.object({
  cursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  orderBy: z.string(),
  orderDirection: z.string(),
  total: z.number().optional(),
});

export const TraceResponseSchema = z.object({
  success: z.literal(true),
  data: AgenticTraceSchema,
});

export const TracesListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    traces: z.array(AgenticTraceSchema),
    pagination: PaginationResponseSchema,
  }),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.string().optional(),
});

// Type exports using zod infer
export type AgentType = z.infer<typeof AgentTypeSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type AgenticTrace = z.infer<typeof AgenticTraceSchema>;

export type CreateTraceRequest = z.infer<typeof CreateTraceRequestSchema>;
export type AddEventRequest = z.infer<typeof AddEventRequestSchema>;
export type ListTracesRequest = z.infer<typeof ListTracesRequestSchema>;
export type GetTraceRequest = z.infer<typeof GetTraceRequestSchema>;

export type TraceResponse = z.infer<typeof TraceResponseSchema>;
export type TracesListResponse = z.infer<typeof TracesListResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type PaginationResponse = z.infer<typeof PaginationResponseSchema>;