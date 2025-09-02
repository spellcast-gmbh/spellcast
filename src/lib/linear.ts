// Re-export everything from the new LinearService for backward compatibility
export * from './linear/LinearService';

// Legacy exports for backward compatibility
import { linearService } from './linear/LinearService';
import type { LinearClient } from '@linear/sdk';

// Legacy exports using the service methods
export const linearClient = (linearService as unknown as { client: LinearClient }).client;
export const LinearEntityResolver = {
  getAllTeams: () => linearService.getAllTeams(),
  getAllUsers: () => linearService.getAllUsers(),
  getAllProjects: () => linearService.getAllProjects(),
  getAllStates: () => linearService.getAllStates(),
  resolveTeam: (teamIdOrName: string) => linearService.resolveTeam(teamIdOrName),
  resolveUser: (userIdOrNameOrEmail: string) => linearService.resolveUser(userIdOrNameOrEmail),
  resolveProject: (projectIdOrName: string) => linearService.resolveProject(projectIdOrName),
  resolveState: (stateIdOrName: string, teamId?: string) => linearService.resolveState(stateIdOrName, teamId),
  resolveDefaultProject: () => linearService.resolveDefaultProject(),
  createResolutionError: async (entityType: 'team' | 'user' | 'project' | 'state', requestedValue: string) => {
    return (linearService as unknown as { createResolutionError: (entityType: string, requestedValue: string) => Promise<string> }).createResolutionError(entityType, requestedValue);
  }
};