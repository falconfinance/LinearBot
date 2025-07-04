export interface User {
  id: string;
  telegram_user_id: string;
  telegram_username?: string;
  full_name: string;
  department: string;
  email?: string;
  is_active: boolean;
  is_authenticated: boolean;
  created_at: Date;
  last_active: Date;
  tickets_created_today: number;
  total_tickets_created: number;
}

export interface TicketRequest {
  id: string;
  telegram_user_id: string;
  telegram_username?: string;
  department: string;
  title: string;
  description: string;
  label: TicketLabel;
  priority: TicketPriority;
  status: TicketStatus;
  linear_ticket_id?: string;
  linear_ticket_url?: string;
  created_at: Date;
  submitted_at?: Date;
  session_data?: Record<string, unknown>;
}

export enum TicketLabel {
  BUG = 'Bug',
  IMPROVEMENT = 'Improvement',
  REQUEST = 'Request',
}

export enum TicketPriority {
  URGENT = 'Urgent',
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low',
}

export enum TicketStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  CREATED = 'created',
  FAILED = 'failed',
}

export enum SessionState {
  IDLE = 'IDLE',
  AWAITING_PASSWORD = 'AWAITING_PASSWORD',
  AWAITING_CATEGORY = 'AWAITING_CATEGORY',
  AWAITING_TITLE = 'AWAITING_TITLE',
  AWAITING_DESCRIPTION = 'AWAITING_DESCRIPTION',
  AWAITING_LABEL = 'AWAITING_LABEL',
  AWAITING_PRIORITY = 'AWAITING_PRIORITY',
  AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION',
}

export interface Session {
  userId: string;
  state: SessionState | LinearSessionState;
  ticketData: Partial<TicketRequest> & { 
    awaitingTemplate?: boolean;
    page?: number;
    searchQuery?: string;
    [key: string]: any;
  };
  lastActivity: Date;
  createdAt: Date;
}

export interface LinearPriority {
  priority: number;
  label: string;
}

// Linear MCP Types
export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: {
    value: number;
    name: string;
  };
  url: string;
  gitBranchName?: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  status: string;
  labels: LinearLabel[];
  attachments: LinearAttachment[];
  createdBy: string;
  createdById: string;
  assignee?: string | { id: string; name?: string; email?: string };
  assigneeId?: string;
  project?: string;
  projectId?: string;
  team: string;
  teamId: string;
  parentId?: string;
  estimate?: number;
}

export interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email?: string;
  };
  issue: {
    id: string;
    identifier: string;
  };
}

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  url: string;
  state: string;
  progress: number;
  startDate?: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    name: string;
  };
  issues: {
    totalCount: number;
  };
  teams: {
    nodes: LinearTeam[];
  };
}

export interface LinearTeam {
  id: string;
  name: string;
  description?: string;
  key: string;
  private: boolean;
  createdAt: string;
  updatedAt: string;
  issueCount: number;
  cycleEnabled: boolean;
  members: {
    nodes: LinearUser[];
  };
}

export interface LinearUser {
  id: string;
  name: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  active: boolean;
  admin: boolean;
  createdAt: string;
  updatedAt: string;
  assignedIssues?: {
    totalCount: number;
  };
}

export interface LinearLabel {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface LinearIssueStatus {
  id: string;
  name: string;
  type: string;
  position: number;
  color: string;
}

export interface LinearAttachment {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

export interface LinearDocument {
  id: string;
  title: string;
  content: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

// Extended Session States for Linear operations
export enum LinearSessionState {
  VIEWING_ISSUES = 'VIEWING_ISSUES',
  VIEWING_ISSUE_DETAIL = 'VIEWING_ISSUE_DETAIL',
  SELECTING_STATUS = 'SELECTING_STATUS',
  SELECTING_ASSIGNEE = 'SELECTING_ASSIGNEE',
  ADDING_COMMENT = 'ADDING_COMMENT',
  SEARCHING_ISSUES = 'SEARCHING_ISSUES',
  VIEWING_PROJECTS = 'VIEWING_PROJECTS',
  UPDATING_STATUS = 'UPDATING_STATUS',
  ASSIGNING_ISSUE = 'ASSIGNING_ISSUE',
  VIEWING_TEAMS = 'VIEWING_TEAMS',
}

// Callback action types for Linear operations
export enum LinearCallbackAction {
  VIEW_ISSUE = 'view_issue',
  UPDATE_STATUS = 'update_status',
  ASSIGN_ISSUE = 'assign_issue',
  ADD_COMMENT = 'add_comment',
  NEXT_PAGE = 'next_page',
  PREV_PAGE = 'prev_page',
  FILTER_PRIORITY = 'filter_priority',
  FILTER_STATUS = 'filter_status',
}

// Filter options for issue listing
export interface IssueFilters {
  assigneeId?: string;
  projectId?: string;
  teamId?: string;
  stateId?: string;
  priority?: number;
  limit?: number;
  offset?: number;
  after?: string; // For cursor-based pagination
  includeArchived?: boolean;
}

// Pagination info
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
}