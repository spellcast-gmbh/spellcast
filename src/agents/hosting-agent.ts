import { Agent, handoff, tool, webSearchTool } from '@openai/agents';
import { env } from '../lib/env';
import { z } from 'zod';
import { AgentTracing, HandoffTracing, ToolTracing } from './util';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import { agenticTraceService } from '@/lib/firebase';
import { linearHandoff } from './linear-agent';
import { Vercel } from '@vercel/sdk';
import { 
  GetDeploymentsRequest, 
  GetDeploymentsResponseBody 
} from '@vercel/sdk/models/getdeploymentsop.js';
import { 
  GetDeploymentRequest, 
  GetDeploymentResponseBody 
} from '@vercel/sdk/models/getdeploymentop.js';
import { 
  GetDeploymentEventsRequest, 
  GetDeploymentEventsResponse 
} from '@vercel/sdk/models/getdeploymenteventsop.js';
import { 
  GetProjectsRequest, 
  GetProjectsResponseBody 
} from '@vercel/sdk/models/getprojectsop.js';

class VercelService {
  private vercel: Vercel;
  private cache = new Map<string, unknown>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes

  constructor(apiKey?: string) {
    const key = apiKey || env.VERCEL_API_KEY;
    if (!key) {
      throw new Error('VERCEL_API_KEY is required for HostingAgent');
    }
    this.vercel = new Vercel({ bearerToken: key });
  }

  private isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  private setCache(key: string, value: unknown): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private getCache(key: string): unknown | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key);
    }
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    return null;
  }

  async getDeployments(limit = 20, projectId?: string): Promise<GetDeploymentsResponseBody> {
    const cacheKey = `deployments:${limit}:${projectId || 'all'}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as GetDeploymentsResponseBody;

    const params: GetDeploymentsRequest = { limit };
    if (projectId) params.projectId = projectId;
    
    const data = await this.vercel.deployments.getDeployments(params);
    this.setCache(cacheKey, data);
    return data;
  }

  async getDeployment(deploymentId: string): Promise<GetDeploymentResponseBody> {
    const cacheKey = `deployment:${deploymentId}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as GetDeploymentResponseBody;

    const params: GetDeploymentRequest = { idOrUrl: deploymentId };
    const data = await this.vercel.deployments.getDeployment(params);
    this.setCache(cacheKey, data);
    return data;
  }

  async getDeploymentLogs(deploymentId: string): Promise<GetDeploymentEventsResponse> {
    const cacheKey = `logs:${deploymentId}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as GetDeploymentEventsResponse;

    const params: GetDeploymentEventsRequest = { idOrUrl: deploymentId };
    const data = await this.vercel.deployments.getDeploymentEvents(params);
    this.setCache(cacheKey, data);
    return data;
  }

  async getProjects(): Promise<GetProjectsResponseBody> {
    const cacheKey = 'projects';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as GetProjectsResponseBody;

    const params: GetProjectsRequest = {};
    const data = await this.vercel.projects.getProjects(params);
    this.setCache(cacheKey, data);
    return data;
  }
}

const vercelService = new VercelService();

const getDeploymentsTool: ToolTracing = (t) => tool({
  name: 'get_deployments',
  description: 'Get a list of deployments from Vercel with their status and metadata',
  parameters: z.object({
    limit: z.number().min(1).max(100).nullable().optional().default(20).describe('Number of deployments to retrieve (1-100)'),
    projectId: z.string().nullable().optional().describe('Filter deployments by project ID')
  }),
  async execute({ limit = 20, projectId }) {
    try {
      const response = await vercelService.getDeployments(limit || 20, projectId || undefined);
      
      const deployments = response.deployments.map((deployment) => ({
        uid: (deployment as any).uid,
        name: deployment.name,
        url: deployment.url,
        state: (deployment as any).state,
        ready: deployment.ready,
        createdAt: deployment.createdAt,
        creator: deployment.creator?.username || 'Unknown',
        target: (deployment as any).target,
        source: (deployment as any).source,
        projectId: (deployment as any).projectId,
        regions: (deployment as any).regions || []
      }));

      const result = {
        deployments,
        pagination: response.pagination,
        totalCount: deployments.length
      };

      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_deployments',
          limit,
          projectId
        },
        agent: 'hosting',
        output: result,
        timestamp: new Date().toISOString(),
        markdown: `Retrieved ${deployments.length} deployments from Vercel.`
      });

      return result;
    } catch (error) {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_deployments',
          limit,
          projectId
        },
        agent: 'hosting',
        output: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        markdown: `Failed to retrieve deployments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return {
        error: `Failed to retrieve deployments: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
});

const getDeploymentStatusTool: ToolTracing = (t) => tool({
  name: 'get_deployment_status',
  description: 'Get detailed status and information about a specific deployment',
  parameters: z.object({
    deploymentId: z.string().describe('The deployment ID to get status for')
  }),
  async execute({ deploymentId }) {
    try {
      const deployment = await vercelService.getDeployment(deploymentId);
      
      const result = {
        uid: (deployment as any).uid || deployment.id,
        name: deployment.name,
        url: deployment.url,
        state: (deployment as any).state || 'UNKNOWN',
        ready: deployment.ready,
        readyState: deployment.readyState,
        createdAt: deployment.createdAt,
        buildingAt: (deployment as any).buildingAt,
        readyAt: (deployment as any).readyAt,
        creator: deployment.creator?.username || 'Unknown',
        target: (deployment as any).target,
        source: (deployment as any).source,
        projectId: (deployment as any).projectId,
        regions: (deployment as any).regions || [],
        functions: (deployment as any).functions || []
      };

      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_deployment_status',
          deploymentId
        },
        agent: 'hosting',
        output: result,
        timestamp: new Date().toISOString(),
        markdown: `Retrieved status for deployment [${deploymentId}](https://${deployment.url}) - State: ${(deployment as any).state || 'UNKNOWN'}`
      });

      return result;
    } catch (error) {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_deployment_status',
          deploymentId
        },
        agent: 'hosting',
        output: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        markdown: `Failed to get deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return {
        error: `Failed to get deployment status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
});

const getDeploymentLogsTool: ToolTracing = (t) => tool({
  name: 'get_deployment_logs',
  description: 'Get build and runtime logs for a specific deployment',
  parameters: z.object({
    deploymentId: z.string().describe('The deployment ID to get logs for'),
    limit: z.number().min(1).max(1000).nullable().optional().default(100).describe('Number of log entries to retrieve (1-1000)')
  }),
  async execute({ deploymentId, limit = 100 }) {
    try {
      const logsResponse = await vercelService.getDeploymentLogs(deploymentId);
      
      // Handle both string response (logs) and object response
      let logs: Array<{
        id: string;
        type: string;
        created: number;
        text: string;
        source?: string;
        level: string;
      }> = [];

      if (typeof logsResponse === 'string') {
        // Parse log lines if it's a string response
        const logLines = (logsResponse as string).split('\n').slice(0, limit || 100);
        logs = logLines.map((line: string, index: number) => ({
          id: `log-${index}`,
          type: 'log',
          created: Date.now(),
          text: line,
          level: 'info'
        }));
      } else if (logsResponse && typeof logsResponse === 'object' && 'events' in logsResponse) {
        // Handle structured event response
        const events = (logsResponse as any).events || [];
        logs = events.slice(0, limit || 100).map((event: any, index: number) => ({
          id: event.id || `event-${index}`,
          type: event.type || 'log',
          created: event.created || Date.now(),
          text: event.payload?.text || event.payload?.message || event.text || 'No message',
          source: event.payload?.source || event.source,
          level: event.payload?.level || event.level || 'info'
        }));
      }

      const result = {
        deploymentId,
        logs,
        totalCount: logs.length,
        hasMore: logs.length >= (limit || 100)
      };

      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_deployment_logs',
          deploymentId,
          limit
        },
        agent: 'hosting',
        output: result,
        timestamp: new Date().toISOString(),
        markdown: `Retrieved ${logs.length} log entries for deployment ${deploymentId}.`
      });

      return result;
    } catch (error) {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_deployment_logs',
          deploymentId,
          limit
        },
        agent: 'hosting',
        output: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        markdown: `Failed to get deployment logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return {
        error: `Failed to get deployment logs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
});

const getProjectsTool: ToolTracing = (t) => tool({
  name: 'get_projects',
  description: 'Get a list of all projects from Vercel',
  parameters: z.object({}),
  async execute() {
    try {
      const response = await vercelService.getProjects();
      
      const projects = response.projects.map((project) => ({
        id: project.id,
        name: project.name,
        accountId: project.accountId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        framework: project.framework,
        devCommand: project.devCommand,
        buildCommand: project.buildCommand,
        outputDirectory: project.outputDirectory,
        publicSource: project.publicSource
      }));

      const result = {
        projects,
        pagination: response.pagination,
        totalCount: projects.length
      };

      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_projects'
        },
        agent: 'hosting',
        output: result,
        timestamp: new Date().toISOString(),
        markdown: `Retrieved ${projects.length} projects from Vercel.`
      });

      return result;
    } catch (error) {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_projects'
        },
        agent: 'hosting',
        output: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        markdown: `Failed to retrieve projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return {
        error: `Failed to retrieve projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
});

export const hostingAgent: AgentTracing = (t) => new Agent({
  name: 'Hosting Agent',
  instructions: `${RECOMMENDED_PROMPT_PREFIX}
  You are a hosting agent specialized in managing Vercel deployments and infrastructure.
    
    Key capabilities:
    - Get list of deployments with their status and metadata
    - Get detailed status information for specific deployments
    - Retrieve build and runtime logs for deployments
    - List all projects in the Vercel account
    - Hand off to Linear agent for issue management tasks
    
    You help users monitor their deployments, debug issues, and understand their infrastructure state.
    Always provide helpful, structured responses about deployment status and logs.`,
  tools: [
    getDeploymentsTool(t),
    getDeploymentStatusTool(t),
    getDeploymentLogsTool(t),
    getProjectsTool(t),
    webSearchTool()
  ],
  handoffs: [linearHandoff(t)]
});

const HostingHandoffInput = z.object({
  task: z.string().describe('A detailed description of the hosting/deployment task to be completed.'),
});
type HostingHandoffInput = z.infer<typeof HostingHandoffInput>;

export const hostingHandoff: HandoffTracing = (t) => handoff(hostingAgent(t), {
  inputType: HostingHandoffInput,
  onHandoff: async (_ctx, input) => {
    await agenticTraceService.addEventToTrace(t.id, {
      type: 'handoff',
      input: {
        data: input,
      },
      agent: 'coordinator',
      output: {},
      timestamp: new Date().toISOString(),
      markdown: `Handed off to Hosting agent.`
    });
  }
});

export default hostingAgent;