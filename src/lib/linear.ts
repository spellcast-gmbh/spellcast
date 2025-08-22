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
  private static cache = new Map<string, any>();
  private static cacheExpiry = new Map<string, number>();
  private static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private static isCacheValid(key: string): boolean {
    const expiry = this.cacheExpiry.get(key);
    return expiry ? Date.now() < expiry : false;
  }

  private static setCache(key: string, value: any): void {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  private static getCache(key: string): any | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key);
    }
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
    return null;
  }

  // Resolve team ID or name to team object
  static async resolveTeam(teamIdOrName: string): Promise<{ id: string; name: string; key: string } | null> {
    const cacheKey = `team:${teamIdOrName}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

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

  // Resolve user ID, email, or name to user object
  static async resolveUser(userIdOrNameOrEmail: string): Promise<{ id: string; name: string; email: string; displayName: string } | null> {
    const cacheKey = `user:${userIdOrNameOrEmail}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

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

  // Resolve project ID or name to project object
  static async resolveProject(projectIdOrName: string): Promise<{ id: string; name: string; key?: string } | null> {
    const cacheKey = `project:${projectIdOrName}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

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

  // Resolve state ID or name to state object (requires team context)
  static async resolveState(stateIdOrName: string, teamId?: string): Promise<{ id: string; name: string; type: string; color: string } | null> {
    const cacheKey = `state:${stateIdOrName}:${teamId || 'global'}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

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
}
