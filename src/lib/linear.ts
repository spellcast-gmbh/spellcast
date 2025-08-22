import { LinearClient } from '@linear/sdk';

if (!process.env.LINEAR_API_KEY) {
  throw new Error('LINEAR_API_KEY environment variable is required');
}

// Initialize Linear client with API key
export const linearClient = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY,
});

// Export types from Linear SDK for convenience
export type { Issue, Team, User, WorkflowState, IssueLabel, Project } from '@linear/sdk';

// UUID regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Check if a string is a UUID
export function isUUID(str: string): boolean {
  return UUID_PATTERN.test(str);
}

// Entity lookup utilities
export class LinearEntityResolver {
  // Cache to avoid repeated API calls
  private static cache = new Map<string, unknown>();
  private static cacheExpiry = new Map<string, number>();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private static isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  private static setCache(key: string, value: unknown): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private static getCache(key: string): unknown | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key);
    }
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    return null;
  }

  // Get all teams with names and keys
  static async getAllTeams(): Promise<Array<{ id: string; name: string; key: string }>> {
    const cacheKey = 'all_teams';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Array<{ id: string; name: string; key: string }>;

    try {
      const teams = await linearClient.teams();
      const result = teams.nodes.map(t => ({ id: t.id, name: t.name, key: t.key }));
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching teams:', error);
      return [];
    }
  }

  // Get all users with names and emails
  static async getAllUsers(): Promise<Array<{ id: string; name: string; email: string; displayName: string }>> {
    const cacheKey = 'all_users';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Array<{ id: string; name: string; email: string; displayName: string }>;

    try {
      const users = await linearClient.users();
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

  // Get all projects with names
  static async getAllProjects(): Promise<Array<{ id: string; name: string }>> {
    const cacheKey = 'all_projects';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Array<{ id: string; name: string }>;

    try {
      const projects = await linearClient.projects();
      const result = projects.nodes.map(p => ({ id: p.id, name: p.name }));
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  }

  // Get all workflow states with names
  static async getAllStates(): Promise<Array<{ id: string; name: string; type: string; color: string }>> {
    const cacheKey = 'all_states';
    const cached = this.getCache(cacheKey);
    if (cached) return cached as Array<{ id: string; name: string; type: string; color: string }>;

    try {
      const states = await linearClient.workflowStates();
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

  // Resolve team ID or name to team object with error information
  static async resolveTeam(teamIdOrName: string): Promise<{ id: string; name: string; key: string } | null> {
    const cacheKey = `team:${teamIdOrName}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string; key: string };

    try {
      // If it's a UUID, get by ID
      if (isUUID(teamIdOrName)) {
        const team = await linearClient.team(teamIdOrName);
        const result = { id: team.id, name: team.name, key: team.key };
        this.setCache(cacheKey, result);
        return result;
      }

      // Otherwise, search by name or key
      const teams = await linearClient.teams();
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

  // Resolve user ID, email, or name to user object with error information
  static async resolveUser(userIdOrNameOrEmail: string): Promise<{ id: string; name: string; email: string; displayName: string } | null> {
    const cacheKey = `user:${userIdOrNameOrEmail}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string; email: string; displayName: string };

    try {
      // If it's a UUID, get by ID
      if (isUUID(userIdOrNameOrEmail)) {
        const user = await linearClient.user(userIdOrNameOrEmail);
        const result = { id: user.id, name: user.name, email: user.email, displayName: user.displayName };
        this.setCache(cacheKey, result);
        return result;
      }

      // Otherwise, search by name, displayName, or email
      const users = await linearClient.users();
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

  // Resolve project ID or name to project object with error information
  static async resolveProject(projectIdOrName: string): Promise<{ id: string; name: string; key?: string } | null> {
    const cacheKey = `project:${projectIdOrName}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string; key?: string };

    try {
      // If it's a UUID, get by ID
      if (isUUID(projectIdOrName)) {
        const project = await linearClient.project(projectIdOrName);
        const result = { id: project.id, name: project.name, key: undefined };
        this.setCache(cacheKey, result);
        return result;
      }

      // Otherwise, search by name
      const projects = await linearClient.projects();
      const project = projects.nodes.find(p => 
        p.name.toLowerCase() === projectIdOrName.toLowerCase()
      );
      
      if (project) {
        const result = { id: project.id, name: project.name, key: undefined };
        this.setCache(cacheKey, result);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('Error resolving project:', error);
      return null;
    }
  }

  // Resolve state ID or name to state object (requires team context) with error information
  static async resolveState(stateIdOrName: string, teamId?: string): Promise<{ id: string; name: string; type: string; color: string } | null> {
    const cacheKey = `state:${stateIdOrName}:${teamId || 'global'}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached as { id: string; name: string; type: string; color: string };

    try {
      // If it's a UUID, get by ID
      if (isUUID(stateIdOrName)) {
        const state = await linearClient.workflowState(stateIdOrName);
        const result = { id: state.id, name: state.name, type: state.type, color: state.color };
        this.setCache(cacheKey, result);
        return result;
      }

      // Get states, optionally filtered by team
      let states;
      if (teamId && isUUID(teamId)) {
        const team = await linearClient.team(teamId);
        states = await team.states();
      } else {
        states = await linearClient.workflowStates();
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

  // Resolve default project from environment
  static async resolveDefaultProject(): Promise<{ id: string; name: string } | null> {
    const defaultProjectId = process.env.DEFAULT_PROJECT_ID;
    if (!defaultProjectId) return null;

    return await this.resolveProject(defaultProjectId);
  }

  // Helper method to create error messages with available names
  static async createResolutionError(entityType: 'team' | 'user' | 'project' | 'state', requestedValue: string): Promise<string> {
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
