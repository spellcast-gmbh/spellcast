import * as yup from 'yup';

// Schema for creating a new issue
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

// Schema for updating an issue
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

// Schema for searching issues
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

// Schema for getting issue by ID
export const getIssueSchema = yup.object().shape({
  id: yup
    .string()
    .required('Issue ID is required'),
});

// Types
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
