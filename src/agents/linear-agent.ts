import { Agent, tool } from '@openai/agents';
import { LinearClient } from '@linear/sdk';
import { env } from '../lib/env';
import { z } from 'zod';
import { AgentTracing, ToolTracing } from './util';
import { RECOMMENDED_PROMPT_PREFIX } from '@openai/agents-core/extensions';
import { agenticTraceService } from '@/lib/firebase';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(str: string): boolean {
  return UUID_PATTERN.test(str);
}

class LinearAgentService {
  public client: LinearClient;
  private cache = new Map<string, unknown>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(apiKey?: string) {
    const key = apiKey || env.LINEAR_API_KEY;
    if (!key) {
      throw new Error('LINEAR_API_KEY is required for LinearAgent');
    }
    this.client = new LinearClient({ apiKey: key });
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

  async resolveTeam(teamIdOrName: string): Promise<{ id: string; name: string; key: string } | null> {
    const cacheKey = `team:${teamIdOrName}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string; key: string };

    try {
      if (isUUID(teamIdOrName)) {
        const team = await this.client.team(teamIdOrName);
        const result = { id: team.id, name: team.name, key: team.key };
        this.setCache(cacheKey, result);
        return result;
      }

      const teams = await this.client.teams();
      const team = teams.nodes.find(t =>
        t.name.toLowerCase() === teamIdOrName.toLowerCase() ||
        t.key.toLowerCase() === teamIdOrName.toLowerCase()
      );

      if (team) {
        const result = { id: team.id, name: team.name, key: team.key };
        this.setCache(cacheKey, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error resolving team:', error);
      return null;
    }
  }

  async resolveUser(userIdOrNameOrEmail: string): Promise<{ id: string; name: string; email: string; displayName: string } | null> {
    const cacheKey = `user:${userIdOrNameOrEmail}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string; email: string; displayName: string };

    try {
      if (isUUID(userIdOrNameOrEmail)) {
        const user = await this.client.user(userIdOrNameOrEmail);
        const result = { id: user.id, name: user.name, email: user.email, displayName: user.displayName };
        this.setCache(cacheKey, result);
        return result;
      }

      const users = await this.client.users();
      const user = users.nodes.find(u =>
        u.name.toLowerCase() === userIdOrNameOrEmail.toLowerCase() ||
        u.displayName.toLowerCase() === userIdOrNameOrEmail.toLowerCase() ||
        u.email.toLowerCase() === userIdOrNameOrEmail.toLowerCase()
      );

      if (user) {
        const result = { id: user.id, name: user.name, email: user.email, displayName: user.displayName };
        this.setCache(cacheKey, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error resolving user:', error);
      return null;
    }
  }

  async resolveProject(projectIdOrName: string): Promise<{ id: string; name: string } | null> {
    const cacheKey = `project:${projectIdOrName}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string };

    try {
      if (isUUID(projectIdOrName)) {
        const project = await this.client.project(projectIdOrName);
        const result = { id: project.id, name: project.name };
        this.setCache(cacheKey, result);
        return result;
      }

      const projects = await this.client.projects();
      const project = projects.nodes.find(p =>
        p.name.toLowerCase() === projectIdOrName.toLowerCase()
      );

      if (project) {
        const result = { id: project.id, name: project.name };
        this.setCache(cacheKey, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error resolving project:', error);
      return null;
    }
  }

  async resolveState(stateIdOrName: string, teamId?: string): Promise<{ id: string; name: string; type: string; color: string } | null> {
    const cacheKey = `state:${stateIdOrName}:${teamId || 'global'}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string; type: string; color: string };

    try {
      if (isUUID(stateIdOrName)) {
        const state = await this.client.workflowState(stateIdOrName);
        const result = { id: state.id, name: state.name, type: state.type, color: state.color };
        this.setCache(cacheKey, result);
        return result;
      }

      let states;
      if (teamId && isUUID(teamId)) {
        const team = await this.client.team(teamId);
        states = await team.states();
      } else {
        states = await this.client.workflowStates();
      }

      const state = states.nodes.find(s =>
        s.name.toLowerCase() === stateIdOrName.toLowerCase()
      );

      if (state) {
        const result = { id: state.id, name: state.name, type: state.type, color: state.color };
        this.setCache(cacheKey, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error resolving state:', error);
      return null;
    }
  }
}

const linearService = new LinearAgentService();

const createIssueTool: ToolTracing = (t) => tool({
  name: 'create_issue',
  description: 'Create a new issue in Linear with the specified details',
  parameters: z.object({
    title: z.string().min(1).max(255),
    description: z.string().nullable().optional(),
    teamId: z.string().describe('Team ID or team name/key'),
    assigneeId: z.string().nullable().optional().describe('User ID, name, or email'),
    priority: z.number().min(0).max(4).nullable().optional(),
    projectId: z.string().nullable().optional().describe('Project ID or project name'),
    stateId: z.string().nullable().optional().describe('State ID or state name')
  }),
  async execute({ title, description, teamId, assigneeId, priority, projectId, stateId }) {
    try {
      const [team, assignee, project, state] = await Promise.all([
        linearService.resolveTeam(teamId),
        assigneeId ? linearService.resolveUser(assigneeId) : null,
        projectId ? linearService.resolveProject(projectId) : null,
        stateId ? linearService.resolveState(stateId) : null,
      ]);

      if (!team) {
        throw new Error(`Team '${teamId}' not found`);
      }
      if (assigneeId && !assignee) {
        throw new Error(`User '${assigneeId}' not found`);
      }
      if (projectId && !project) {
        throw new Error(`Project '${projectId}' not found`);
      }
      if (stateId && !state) {
        throw new Error(`State '${stateId}' not found`);
      }

      const issuePayload = await linearService.client.createIssue({
        title,
        description,
        teamId: team.id,
        assigneeId: assignee?.id,
        priority,
        projectId: project?.id,
        stateId: state?.id,
      });

      const issue = await issuePayload.issue;
      if (!issue) {
        throw new Error('Failed to create issue');
      }

      const result = {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        number: issue.number,
        url: issue.url,
        priority: issue.priority,
        createdAt: issue.createdAt.toISOString(),
        team: team ? { id: team.id, name: team.name, key: team.key } : null,
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
          displayName: assignee.displayName,
          email: assignee.email
        } : null,
        project: project ? { id: project.id, name: project.name } : null,
        state: state ? {
          id: state.id,
          name: state.name,
          type: state.type,
          color: state.color
        } : null,
      };

      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'create_issue',
        },
        agent: 'linear',
        output: result,
        timestamp: new Date().toISOString(),
        markdown: `Created issue [${issue.id}](${issue.url}) with title ${issue.title}.`
      });

      return result;
    } catch (error) {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'create_issue',
          title, description, teamId, assigneeId, priority, projectId, stateId
        },
        output: {
          error
        },
        timestamp: new Date().toISOString(),
        markdown: `Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        agent: 'linear',
      });
      throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

const searchIssuesTool: ToolTracing = (t) => tool({
  name: 'search_issues',
  description: 'Search for issues in Linear based on various criteria',
  parameters: z.object({
    query: z.string().nullable().optional().describe('Text search query for issue titles'),
    teamId: z.string().nullable().optional().describe('Team ID or team name/key to filter by'),
    assigneeId: z.string().nullable().optional().describe('User ID, name, or email to filter by'),
    stateId: z.string().nullable().optional().describe('State ID or state name to filter by'),
    projectId: z.string().nullable().optional().describe('Project ID or project name to filter by'),
    limit: z.number().min(1).max(100).nullable().optional().default(50)
  }),
  async execute({ query, teamId, assigneeId, stateId, projectId, limit = 50 }) {
    try {
      const filter: Record<string, unknown> = {};

      const [team, assignee, project, state] = await Promise.all([
        teamId ? linearService.resolveTeam(teamId) : null,
        assigneeId ? linearService.resolveUser(assigneeId) : null,
        projectId ? linearService.resolveProject(projectId) : null,
        stateId ? linearService.resolveState(stateId) : null,
      ]);

      if (team) {
        filter.team = { id: { eq: team.id } };
      } else if (teamId) {
        throw new Error(`Team '${teamId}' not found`);
      }

      if (assignee) {
        filter.assignee = { id: { eq: assignee.id } };
      } else if (assigneeId) {
        throw new Error(`User '${assigneeId}' not found`);
      }

      if (project) {
        filter.project = { id: { eq: project.id } };
      } else if (projectId) {
        throw new Error(`Project '${projectId}' not found`);
      }

      if (state) {
        filter.state = { id: { eq: state.id } };
      } else if (stateId) {
        throw new Error(`State '${stateId}' not found`);
      }

      if (query) {
        filter.title = { containsIgnoreCase: query };
      }

      const issues = await linearService.client.issues({
        filter,
        first: limit,
      });

      const formattedIssues = await Promise.all(
        issues.nodes.map(async (issue) => {
          const [team, assignee, state, labels, project] = await Promise.all([
            issue.team,
            issue.assignee,
            issue.state,
            issue.labels(),
            issue.project,
          ]);

          return {
            id: issue.id,
            title: issue.title,
            description: issue.description,
            number: issue.number,
            url: issue.url,
            priority: issue.priority,
            createdAt: issue.createdAt.toISOString(),
            updatedAt: issue.updatedAt.toISOString(),
            team: team ? { id: team.id, name: team.name, key: team.key } : null,
            assignee: assignee ? {
              id: assignee.id,
              name: assignee.name,
              displayName: assignee.displayName,
              email: assignee.email
            } : null,
            project: project ? { id: project.id, name: project.name } : null,
            state: state ? {
              id: state.id,
              name: state.name,
              type: state.type,
              color: state.color
            } : null,
            labels: labels.nodes.map(l => ({ id: l.id, name: l.name, color: l.color })),
          };
        })
      );

      const result = {
        issues: formattedIssues,
        totalCount: issues.nodes.length,
        hasNextPage: issues.pageInfo.hasNextPage,
        appliedFilters: { team, assignee, project, state, query }
      };

      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'search_issues',
          query, teamId, assigneeId, stateId, projectId, limit
        },
        agent: 'linear',
        output: result,
        timestamp: new Date().toISOString(),
        markdown: `Found ${formattedIssues.length} issues.`
      });

      return result;
    } catch (error) {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'search_issues',
          query, teamId, assigneeId, stateId, projectId, limit
        },
        agent: 'linear',
        output: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        markdown: `Failed to search issues: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw new Error(`Failed to search issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

const getIssueTool: ToolTracing = (t) => tool({
  name: 'get_issue',
  description: 'Get detailed information about a specific issue by ID',
  parameters: z.object({
    id: z.string().describe('Issue ID')
  }),
  async execute({ id }) {
    try {
      const issue = await linearService.client.issue(id);
      if (!issue) {
        throw new Error('Issue not found');
      }

      const [team, assignee, state, labels, project] = await Promise.all([
        issue.team,
        issue.assignee,
        issue.state,
        issue.labels(),
        issue.project,
      ]);

      const result = {
        id: issue.id,
        title: issue.title,
        description: issue.description,
        number: issue.number,
        url: issue.url,
        priority: issue.priority,
        createdAt: issue.createdAt.toISOString(),
        updatedAt: issue.updatedAt.toISOString(),
        team: team ? { id: team.id, name: team.name, key: team.key } : null,
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
          displayName: assignee.displayName,
          email: assignee.email
        } : null,
        project: project ? { id: project.id, name: project.name } : null,
        state: state ? {
          id: state.id,
          name: state.name,
          type: state.type,
          color: state.color
        } : null,
        labels: labels.nodes.map(l => ({ id: l.id, name: l.name, color: l.color })),
      };

      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_issue',
          id
        },
        agent: 'linear',
        output: result,
        timestamp: new Date().toISOString(),
        markdown: `Got issue [${issue.id}](${issue.url}) with title ${issue.title}.`
      });

      return result;
    } catch (error) {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'get_issue',
          id
        },
        agent: 'linear',
        output: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        markdown: `Failed to get issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw new Error(`Failed to get issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

const updateIssueTool: ToolTracing = (t) => tool({
  name: 'update_issue',
  description: 'Update an existing issue with new information',
  parameters: z.object({
    id: z.string().describe('Issue ID'),
    title: z.string().min(1).max(255).nullable().optional(),
    description: z.string().nullable().optional(),
    assigneeId: z.string().nullable().optional().describe('User ID, name, or email'),
    priority: z.number().min(0).max(4).nullable().optional(),
    projectId: z.string().nullable().optional().describe('Project ID or project name'),
    stateId: z.string().nullable().optional().describe('State ID or state name')
  }),
  async execute({ id, title, description, assigneeId, priority, projectId, stateId }) {
    try {
      const existingIssue = await linearService.client.issue(id);
      if (!existingIssue) {
        throw new Error('Issue not found');
      }

      const [assignee, project, state] = await Promise.all([
        assigneeId ? linearService.resolveUser(assigneeId) : null,
        projectId ? linearService.resolveProject(projectId) : null,
        stateId ? linearService.resolveState(stateId, existingIssue.teamId) : null,
      ]);

      if (assigneeId && !assignee) {
        throw new Error(`User '${assigneeId}' not found`);
      }
      if (projectId && !project) {
        throw new Error(`Project '${projectId}' not found`);
      }
      if (stateId && !state) {
        throw new Error(`State '${stateId}' not found`);
      }

      const updatePayload = await linearService.client.updateIssue(id, {
        title,
        description,
        assigneeId: assignee?.id,
        priority,
        projectId: project?.id,
        stateId: state?.id,
      });

      const updatedIssue = await updatePayload.issue;
      if (!updatedIssue) {
        throw new Error('Failed to update issue');
      }

      const team = await updatedIssue.team;

      const result = {
        id: updatedIssue.id,
        title: updatedIssue.title,
        description: updatedIssue.description,
        number: updatedIssue.number,
        url: updatedIssue.url,
        priority: updatedIssue.priority,
        updatedAt: updatedIssue.updatedAt.toISOString(),
        team: team ? { id: team.id, name: team.name, key: team.key } : null,
        assignee: assignee ? {
          id: assignee.id,
          name: assignee.name,
          displayName: assignee.displayName,
          email: assignee.email
        } : null,
        project: project ? { id: project.id, name: project.name } : null,
        state: state ? {
          id: state.id,
          name: state.name,
          type: state.type,
          color: state.color
        } : null,
      };

      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'update_issue',
          id, title, description, assigneeId, priority, projectId, stateId
        },
        agent: 'linear',
        output: result,
        timestamp: new Date().toISOString(),
        markdown: `Updated issue [${updatedIssue.id}](${updatedIssue.url}) with title ${updatedIssue.title}.`
      });

      return result;
    } catch (error) {
      await agenticTraceService.addEventToTrace(t.id, {
        type: 'tool',
        input: {
          tool: 'update_issue',
          id, title, description, assigneeId, priority, projectId, stateId
        },
        agent: 'linear',
        output: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString(),
        markdown: `Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw new Error(`Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

export const linearAgent: AgentTracing = (t) => new Agent({
  name: 'Linear Agent',
  instructions: `${RECOMMENDED_PROMPT_PREFIX}
  You are a Linear issue management agent. You can create, search, get, and update Linear issues.
    
    Key capabilities:
    - Create new issues with titles, descriptions, team assignments, etc.
    - Search for issues by text, team, assignee, state, or project
    - Get detailed information about specific issues
    - Update existing issues with new information
    
    You can resolve team names, user names/emails, project names, and state names to their IDs automatically.
    Always provide helpful, structured responses about Linear issues.`,
  tools: [
    createIssueTool(t),
    searchIssuesTool(t),
    getIssueTool(t),
    updateIssueTool(t)
  ]
});

export default linearAgent;