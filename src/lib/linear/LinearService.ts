import { LinearClient } from '@linear/sdk';
import { env } from '../env';
import * as yup from 'yup';

// Export types from Linear SDK for convenience
export type { Issue, Team, User, WorkflowState, IssueLabel, Project } from '@linear/sdk';

// Custom interfaces for API responses
export interface LinearIssueResponse {
  id: string;
  title: string;
  description?: string;
  number: number;
  priority: number;
  state: {
    id: string;
    name: string;
    type: string;
    color: string;
  } | null;
  team: {
    id: string;
    name: string;
    key: string;
  } | null;
  assignee: {
    id: string;
    name: string;
    email: string;
    displayName?: string;
  } | null;
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  project: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface LinearSearchResponse {
  issues: LinearIssueResponse[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  appliedFilters?: Record<string, unknown>;
  pagination?: {
    limit: number;
    offset: number;
  };
}

export interface CacheEntry {
  data: unknown;
  timestamp: number;
}

// Validation schemas
export const createIssueSchema = yup.object().shape({
  title: yup
    .string()
    .required('Title is required')
    .min(1, 'Title must not be empty')
    .max(255, 'Title must not exceed 255 characters'),
  description: yup
    .string()
    .optional(),
  teamId: yup
    .string()
    .required('Team ID or name is required'),
  assigneeId: yup
    .string()
    .optional(),
  priority: yup
    .number()
    .optional()
    .min(0, 'Priority must be between 0 and 4')
    .max(4, 'Priority must be between 0 and 4'),
  labelIds: yup
    .array(yup.string())
    .optional(),
  projectId: yup
    .string()
    .optional(),
  stateId: yup
    .string()
    .optional(),
});

export const updateIssueSchema = yup.object().shape({
  title: yup
    .string()
    .optional()
    .min(1, 'Title must not be empty')
    .max(255, 'Title must not exceed 255 characters'),
  description: yup
    .string()
    .optional(),
  assigneeId: yup
    .string()
    .optional(),
  priority: yup
    .number()
    .optional()
    .min(0, 'Priority must be between 0 and 4')
    .max(4, 'Priority must be between 0 and 4'),
  labelIds: yup
    .array(yup.string())
    .optional(),
  projectId: yup
    .string()
    .optional(),
  stateId: yup
    .string()
    .optional(),
});

export const searchIssuesSchema = yup.object().shape({
  query: yup
    .string()
    .optional(),
  teamId: yup
    .string()
    .optional(),
  assigneeId: yup
    .string()
    .optional(),
  stateId: yup
    .string()
    .optional(),
  projectId: yup
    .string()
    .optional(),
  limit: yup
    .number()
    .optional()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must not exceed 100'),
  offset: yup
    .number()
    .optional()
    .min(0, 'Offset must be non-negative'),
});

export const getIssueSchema = yup.object().shape({
  id: yup
    .string()
    .required('Issue ID is required'),
});

// Type definitions
export interface CreateIssuePayload {
  title: string;
  description?: string;
  teamId: string;
  assigneeId?: string;
  priority?: number;
  labelIds?: string[];
  projectId?: string;
  stateId?: string;
}

export interface UpdateIssuePayload {
  title?: string;
  description?: string;
  assigneeId?: string;
  priority?: number;
  labelIds?: string[];
  projectId?: string;
  stateId?: string;
}

export interface SearchIssuesPayload {
  query?: string;
  teamId?: string;
  assigneeId?: string;
  stateId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export interface GetIssuePayload {
  id: string;
}

// UUID regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Check if a string is a UUID
export function isUUID(str: string): boolean {
  return UUID_PATTERN.test(str);
}

/**
 * Comprehensive Linear service for managing Linear issues and entities
 * This class encapsulates all Linear functionality that was previously exposed via API endpoints
 */
export class LinearService {
  private client: LinearClient;
  
  // Cache to avoid repeated API calls
  private cache = new Map<string, unknown>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(apiKey?: string) {
    const key = apiKey || env.LINEAR_API_KEY;
    if (!key) {
      throw new Error('LINEAR_API_KEY is required for LinearService');
    }
    
    this.client = new LinearClient({ apiKey: key });
  }

  // Cache management
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

  // Entity resolution methods
  async getAllTeams(): Promise<Array<{ id: string; name: string; key: string }>> {
    const cacheKey = 'all_teams';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Array<{ id: string; name: string; key: string }>;

    try {
      const teams = await this.client.teams();
      const result = teams.nodes.map(t => ({ id: t.id, name: t.name, key: t.key }));
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  }

  async getAllUsers(): Promise<Array<{ id: string; name: string; email: string; displayName: string }>> {
    const cacheKey = 'all_users';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Array<{ id: string; name: string; email: string; displayName: string }>;

    try {
      const users = await this.client.users();
      const result = users.nodes.map(u => ({ 
        id: u.id, 
        name: u.name, 
        email: u.email, 
        displayName: u.displayName 
      }));
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }

  async getAllProjects(): Promise<Array<{ id: string; name: string }>> {
    const cacheKey = 'all_projects';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Array<{ id: string; name: string }>;

    try {
      const projects = await this.client.projects();
      const result = projects.nodes.map(p => ({ id: p.id, name: p.name }));
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }

  async getAllStates(): Promise<Array<{ id: string; name: string; type: string; color: string }>> {
    const cacheKey = 'all_states';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Array<{ id: string; name: string; type: string; color: string }>;

    try {
      const states = await this.client.workflowStates();
      const result = states.nodes.map(s => ({ 
        id: s.id, 
        name: s.name, 
        type: s.type, 
        color: s.color 
      }));
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching states:', error);
      return [];
    }
  }

  async resolveTeam(teamIdOrName: string): Promise<{ id: string; name: string; key: string } | null> {
    const cacheKey = `team:${teamIdOrName}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string; key: string };

    try {
      // If it's a UUID, get by ID
      if (isUUID(teamIdOrName)) {
        const team = await this.client.team(teamIdOrName);
        const result = { id: team.id, name: team.name, key: team.key };
        this.setCache(cacheKey, result);
        return result;
      }

      // Otherwise, search by name or key
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
      // If it's a UUID, get by ID
      if (isUUID(userIdOrNameOrEmail)) {
        const user = await this.client.user(userIdOrNameOrEmail);
        const result = { id: user.id, name: user.name, email: user.email, displayName: user.displayName };
        this.setCache(cacheKey, result);
        return result;
      }

      // Otherwise, search by name, displayName, or email
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
      // If it's a UUID, get by ID
      if (isUUID(projectIdOrName)) {
        const project = await this.client.project(projectIdOrName);
        const result = { id: project.id, name: project.name };
        this.setCache(cacheKey, result);
        return result;
      }

      // Otherwise, search by name
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
      // If it's a UUID, get by ID
      if (isUUID(stateIdOrName)) {
        const state = await this.client.workflowState(stateIdOrName);
        const result = { id: state.id, name: state.name, type: state.type, color: state.color };
        this.setCache(cacheKey, result);
        return result;
      }

      // Get states, optionally filtered by team
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

  async resolveDefaultProject(): Promise<{ id: string; name: string } | null> {
    const defaultProjectId = env.DEFAULT_PROJECT_ID;
    if (!defaultProjectId) return null;

    return await this.resolveProject(defaultProjectId);
  }

  // Issue management methods
  async createIssue(payload: CreateIssuePayload): Promise<LinearIssueResponse> {
    // Validate payload
    const validatedData = await createIssueSchema.validate(payload);

    // Resolve entity names to IDs
    const [team, assignee, project, state] = await Promise.all([
      this.resolveTeam(validatedData.teamId),
      validatedData.assigneeId ? this.resolveUser(validatedData.assigneeId) : null,
      validatedData.projectId ? this.resolveProject(validatedData.projectId) : this.resolveDefaultProject(),
      validatedData.stateId ? this.resolveState(validatedData.stateId) : null,
    ]);

    // Check if team was found
    if (!team) {
      const errorMessage = await this.createResolutionError('team', validatedData.teamId);
      throw new Error(errorMessage);
    }

    // Check if assignee was specified but not found
    if (validatedData.assigneeId && !assignee) {
      const errorMessage = await this.createResolutionError('user', validatedData.assigneeId);
      throw new Error(errorMessage);
    }

    // Check if project was specified but not found
    if (validatedData.projectId && !project) {
      const errorMessage = await this.createResolutionError('project', validatedData.projectId);
      throw new Error(errorMessage);
    }

    // Check if state was specified but not found
    if (validatedData.stateId && !state) {
      const errorMessage = await this.createResolutionError('state', validatedData.stateId);
      throw new Error(errorMessage);
    }

    // Create issue using Linear SDK with resolved IDs
    const issuePayload = await this.client.createIssue({
      title: validatedData.title,
      description: validatedData.description,
      teamId: team.id,
      assigneeId: assignee?.id,
      priority: validatedData.priority,
      labelIds: validatedData.labelIds?.filter(Boolean) as string[] | undefined,
      projectId: project?.id,
      stateId: state?.id,
    });

    const issue = await issuePayload.issue;

    if (!issue) {
      throw new Error('Failed to create issue');
    }

    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      number: issue.number,
      url: issue.url,
      priority: issue.priority,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
      // Include resolved entity information
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
      labels: [], // Labels will be populated if needed
    };
  }

  async updateIssue(issueId: string, payload: UpdateIssuePayload): Promise<LinearIssueResponse> {
    // Validate payload
    const validatedData = await updateIssueSchema.validate(payload);

    // Get the issue first to check if it exists
    const existingIssue = await this.client.issue(issueId);
    if (!existingIssue) {
      throw new Error('Issue not found');
    }

    // Resolve entity names to IDs if provided
    const [assignee, project, state] = await Promise.all([
      validatedData.assigneeId ? this.resolveUser(validatedData.assigneeId) : null,
      validatedData.projectId ? this.resolveProject(validatedData.projectId) : null,
      validatedData.stateId ? this.resolveState(validatedData.stateId, existingIssue.teamId) : null,
    ]);

    // Check resolutions
    if (validatedData.assigneeId && !assignee) {
      const errorMessage = await this.createResolutionError('user', validatedData.assigneeId);
      throw new Error(errorMessage);
    }

    if (validatedData.projectId && !project) {
      const errorMessage = await this.createResolutionError('project', validatedData.projectId);
      throw new Error(errorMessage);
    }

    if (validatedData.stateId && !state) {
      const errorMessage = await this.createResolutionError('state', validatedData.stateId);
      throw new Error(errorMessage);
    }

    // Update issue
    const updatePayload = await this.client.updateIssue(issueId, {
      title: validatedData.title,
      description: validatedData.description,
      assigneeId: assignee?.id,
      priority: validatedData.priority,
      labelIds: validatedData.labelIds?.filter(Boolean) as string[] | undefined,
      projectId: project?.id,
      stateId: state?.id,
    });

    const updatedIssue = await updatePayload.issue;

    if (!updatedIssue) {
      throw new Error('Failed to update issue');
    }

    const team = await updatedIssue.team;

    return {
      id: updatedIssue.id,
      title: updatedIssue.title,
      description: updatedIssue.description,
      number: updatedIssue.number,
      url: updatedIssue.url,
      priority: updatedIssue.priority,
      createdAt: updatedIssue.createdAt.toISOString(),
      updatedAt: updatedIssue.updatedAt.toISOString(),
      // Include resolved entity information
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
      labels: [], // Labels will be populated if needed
    };
  }

  async getIssue(issueId: string): Promise<LinearIssueResponse> {
    const validatedData = await getIssueSchema.validate({ id: issueId });
    
    const issue = await this.client.issue(validatedData.id);
    if (!issue) {
      throw new Error('Issue not found');
    }

    // Get related entities
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
  }

  async searchIssues(payload: SearchIssuesPayload): Promise<LinearSearchResponse> {
    const validatedData = await searchIssuesSchema.validate(payload);
    
    // Build filter object for Linear
    const filter: Record<string, unknown> = {};
    
    // Resolve entities to IDs for filtering
    const [team, assignee, project, state] = await Promise.all([
      validatedData.teamId ? this.resolveTeam(validatedData.teamId) : null,
      validatedData.assigneeId ? this.resolveUser(validatedData.assigneeId) : null,
      validatedData.projectId ? this.resolveProject(validatedData.projectId) : null,
      validatedData.stateId ? this.resolveState(validatedData.stateId) : null,
    ]);

    // Build filter with resolved IDs
    if (team) {
      filter.team = { id: { eq: team.id } };
    } else if (validatedData.teamId) {
      const errorMessage = await this.createResolutionError('team', validatedData.teamId);
      throw new Error(errorMessage);
    }

    if (assignee) {
      filter.assignee = { id: { eq: assignee.id } };
    } else if (validatedData.assigneeId) {
      const errorMessage = await this.createResolutionError('user', validatedData.assigneeId);
      throw new Error(errorMessage);
    }

    if (project) {
      filter.project = { id: { eq: project.id } };
    } else if (validatedData.projectId) {
      const errorMessage = await this.createResolutionError('project', validatedData.projectId);
      throw new Error(errorMessage);
    }

    if (state) {
      filter.state = { id: { eq: state.id } };
    } else if (validatedData.stateId) {
      const errorMessage = await this.createResolutionError('state', validatedData.stateId);
      throw new Error(errorMessage);
    }

    // Add text search if provided
    if (validatedData.query) {
      filter.title = { containsIgnoreCase: validatedData.query };
    }

    const issues = await this.client.issues({
      filter,
      first: validatedData.limit || 50,
      // Note: Linear API uses cursor-based pagination, not offset
      // For offset-based queries, we'll need to implement cursor handling
    });

    // Format the response with resolved entity information
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

    return {
      issues: formattedIssues,
      totalCount: issues.nodes.length,
      hasNextPage: issues.pageInfo.hasNextPage,
      hasPreviousPage: issues.pageInfo.hasPreviousPage,
      appliedFilters: {
        team,
        assignee,
        project,
        state,
        query: validatedData.query,
      },
    };
  }

  async listIssues(limit: number = 50, offset: number = 0, teamId?: string): Promise<LinearSearchResponse> {
    const filter: Record<string, unknown> = {};
    
    // If team is specified, resolve and filter by it
    if (teamId) {
      const team = await this.resolveTeam(teamId);
      if (!team) {
        const errorMessage = await this.createResolutionError('team', teamId);
        throw new Error(errorMessage);
      }
      filter.team = { id: { eq: team.id } };
    }

    const issues = await this.client.issues({
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      first: limit,
      // Note: Linear API uses cursor-based pagination, not offset
      // For offset-based queries, we'll need to implement cursor handling
    });

    // Format the response
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

    return {
      issues: formattedIssues,
      totalCount: issues.nodes.length,
      hasNextPage: issues.pageInfo.hasNextPage,
      hasPreviousPage: issues.pageInfo.hasPreviousPage,
      pagination: {
        limit,
        offset,
      },
    };
  }

  // Helper method to create error messages with available names
  private async createResolutionError(entityType: 'team' | 'user' | 'project' | 'state', requestedValue: string): Promise<string> {
    let availableNames: string[] = [];
    
    try {
      switch (entityType) {
        case 'team':
          const teams = await this.getAllTeams();
          availableNames = teams.map(t => `${t.name} (${t.key})`);
          break;
        case 'user':
          const users = await this.getAllUsers();
          availableNames = users.map(u => `${u.displayName} (${u.email})`);
          break;
        case 'project':
          const projects = await this.getAllProjects();
          availableNames = projects.map(p => p.name);
          break;
        case 'state':
          const states = await this.getAllStates();
          availableNames = states.map(s => s.name);
          break;
      }
    } catch (error) {
      console.error(`Error fetching available ${entityType}s:`, error);
      availableNames = [];
    }

    const entityTypeCapitalized = entityType.charAt(0).toUpperCase() + entityType.slice(1);
    let errorMessage = `${entityTypeCapitalized} '${requestedValue}' not found.`;
    
    if (availableNames.length > 0) {
      const maxNames = 10; // Limit to prevent overly long error messages
      const namesToShow = availableNames.slice(0, maxNames);
      const remainingCount = availableNames.length - maxNames;
      
      errorMessage += ` Available ${entityType}s: ${namesToShow.join(', ')}`;
      
      if (remainingCount > 0) {
        errorMessage += ` and ${remainingCount} more`;
      }
    } else {
      errorMessage += ` Unable to fetch available ${entityType}s.`;
    }
    
    return errorMessage;
  }
}

// Export singleton instance for backwards compatibility
export const linearService = new LinearService();