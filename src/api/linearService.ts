import { LinearClient } from '@linear/sdk';
import { config } from '../config';
import { 
  TicketPriority, 
  TicketLabel, 
  LinearIssue, 
  LinearProject, 
  LinearTeam, 
  LinearUser, 
  LinearComment,
  LinearIssueStatus,
  LinearLabel,
  IssueFilters 
} from '../types';
import { logger as Logger } from '../utils/logger';

export class LinearService {
  private client: LinearClient;
  private labelMap: Map<TicketLabel, string> = new Map();
  private teamId: string;
  private projectId: string;
  private reginaUserId: string;
  private apiCallCount = 0;
  private apiCallStartTime = Date.now();

  constructor(private logger: typeof Logger) {
    this.client = new LinearClient({ apiKey: config.linear.apiKey });
    this.teamId = config.linear.teamId;
    this.projectId = config.linear.projectId;
    this.reginaUserId = config.linear.reginaUserId;
    
    this.initializeLabelMap();
  }

  private logApiCall(method: string) {
    this.apiCallCount++;
    const timeSinceStart = Date.now() - this.apiCallStartTime;
    
    // Reset counter every hour
    if (timeSinceStart > 3600000) {
      this.apiCallCount = 1;
      this.apiCallStartTime = Date.now();
    }
    
    this.logger.info(`Linear API Call - ${method} (${this.apiCallCount} calls this hour)`);
  }

  private getPriorityName(priority: number): string {
    switch (priority) {
      case 0: return 'No priority';
      case 1: return 'Urgent';
      case 2: return 'High';
      case 3: return 'Medium';
      case 4: return 'Low';
      default: return 'No priority';
    }
  }

  private initializeLabelMap(): void {
    // Label IDs from your Linear workspace
    this.labelMap.set(TicketLabel.BUG, '0215f87d-e2c6-4c84-b696-2a45a69f7466');
    this.labelMap.set(TicketLabel.IMPROVEMENT, 'fecd0d51-72fa-4aa9-8631-f78f857364e3');
    this.labelMap.set(TicketLabel.REQUEST, '4a324a4e-a3b6-4316-b514-ac9f5c96d08d'); // Using Ad-Hoc label for Request
  }

  async createTicket(ticketData: {
    title: string;
    description: string;
    label: TicketLabel;
    priority: TicketPriority;
    createdBy: string;
    department: string;
  }): Promise<{ id: string; identifier: string; url: string }> {
    try {
      this.logApiCall('createTicket');
      const issueInput = {
        title: ticketData.title,
        description: this.formatDescription(ticketData.description, ticketData.createdBy, ticketData.department),
        teamId: this.teamId,
        projectId: this.projectId,
        assigneeId: this.reginaUserId,
        priority: this.mapPriority(ticketData.priority),
        labelIds: [this.getLabelId(ticketData.label)],
      };

      const issuePayload = await this.client.createIssue(issueInput);
      const issue = await issuePayload.issue;
      
      if (!issue) {
        throw new Error('Failed to create issue - no issue returned');
      }
      
      this.logger.info('Linear ticket created', {
        ticketId: issue.id,
        identifier: issue.identifier,
        createdBy: ticketData.createdBy,
      });

      return {
        id: issue.id,
        identifier: issue.identifier,
        url: issue.url,
      };
    } catch (error) {
      this.logger.error('Failed to create Linear ticket:', error);
      throw new Error('Failed to create ticket in Linear. Please try again later.');
    }
  }

  private formatDescription(description: string, createdBy: string, department: string): string {
    return `${description}

---
**Created by:** ${createdBy} (${department})
**Via:** Telegram Bot`;
  }

  private mapPriority(priority: TicketPriority): number {
    const priorityMap: Record<TicketPriority, number> = {
      [TicketPriority.URGENT]: 1,
      [TicketPriority.HIGH]: 2,
      [TicketPriority.MEDIUM]: 3,
      [TicketPriority.LOW]: 4,
    };

    return priorityMap[priority];
  }

  private getLabelId(label: TicketLabel): string {
    const labelId = this.labelMap.get(label);
    
    if (!labelId) {
      this.logger.warn(`Label ID not found for: ${label}`);
      return 'default-label-id'; // Fallback label ID
    }
    
    return labelId;
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      // Verify team exists
      const team = await this.client.team(this.teamId);
      if (!team) {
        this.logger.error('Team not found with ID:', this.teamId);
        return false;
      }

      // Verify project exists
      const project = await this.client.project(this.projectId);
      if (!project) {
        this.logger.error('Project not found with ID:', this.projectId);
        return false;
      }

      // Verify user exists
      const user = await this.client.user(this.reginaUserId);
      if (!user) {
        this.logger.error('User (Regina) not found with ID:', this.reginaUserId);
        return false;
      }

      this.logger.info('Linear configuration verified successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to verify Linear configuration:', error);
      return false;
    }
  }

  async fetchAndUpdateLabelIds(): Promise<void> {
    try {
      const team = await this.client.team(this.teamId);
      const labels = await team.labels();

      // Map actual label IDs from Linear
      for (const label of labels.nodes) {
        const normalizedName = label.name.toLowerCase();
        
        if (normalizedName.includes('bug')) {
          this.labelMap.set(TicketLabel.BUG, label.id);
        } else if (normalizedName.includes('improvement')) {
          this.labelMap.set(TicketLabel.IMPROVEMENT, label.id);
        } else if (normalizedName.includes('request') || normalizedName.includes('ad-hoc') || normalizedName.includes('other')) {
          this.labelMap.set(TicketLabel.REQUEST, label.id);
        }
      }

      this.logger.info('Label IDs updated from Linear');
    } catch (error) {
      this.logger.error('Failed to fetch label IDs from Linear:', error);
    }
  }

  // Enhanced Linear MCP Methods

  async listIssues(filters: IssueFilters = {}): Promise<LinearIssue[]> {
    try {
      this.logApiCall('listIssues');
      
      // Use a single GraphQL query to fetch all data at once
      const query = `
        query ListIssues($filter: IssueFilter, $includeArchived: Boolean, $first: Int, $after: String) {
          issues(filter: $filter, orderBy: updatedAt, includeArchived: $includeArchived, first: $first, after: $after) {
            nodes {
              id
              identifier
              title
              description
              priority
              dueDate
              createdAt
              updatedAt
              url
              state {
                id
                name
                type
                color
              }
              assignee {
                id
                name
                email
              }
              creator {
                id
                name
                email
              }
              team {
                id
                name
                key
              }
              project {
                id
                name
              }
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              attachments {
                nodes {
                  id
                  title
                  url
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const variables = {
        filter: {
          ...(filters.assigneeId && { assignee: { id: { eq: filters.assigneeId } } }),
          ...(filters.projectId && { project: { id: { eq: filters.projectId } } }),
          ...(filters.teamId && { team: { id: { eq: filters.teamId } } }),
          ...(filters.stateId && { state: { id: { eq: filters.stateId } } }),
          ...(filters.priority && { priority: { eq: filters.priority } }),
        },
        includeArchived: filters.includeArchived || false,
        first: filters.limit || 50,
        after: filters.after || null,
      };

      const response = await (this.client as any).client.rawRequest(query, variables);
      const issues = response.data.issues;

      // Map the response to our LinearIssue interface
      const mappedIssues = issues.nodes.map((issue: any) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        priority: {
          value: issue.priority || 0,
          name: this.getPriorityName(issue.priority || 0),
        },
        dueDate: issue.dueDate,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        url: issue.url,
        status: issue.state?.name || 'Unknown',
        assignee: issue.assignee,
        assigneeId: issue.assignee?.id,
        createdBy: issue.creator?.name || issue.creator?.email || 'Unknown',
        createdById: issue.creator?.id || '',
        team: issue.team?.name || 'Unknown',
        teamId: issue.team?.id || '',
        project: issue.project?.name,
        projectId: issue.project?.id,
        labels: issue.labels?.nodes || [],
        attachments: issue.attachments?.nodes || [],
      }));

      return mappedIssues;
    } catch (error) {
      this.logger.error('Failed to fetch issues:', error);
      throw new Error('Failed to fetch issues from Linear');
    }
  }

  async getIssue(issueId: string): Promise<LinearIssue | null> {
    try {
      const issue = await this.client.issue(issueId);
      if (!issue) return null;
      
      // Fetch related data
      const state = await issue.state;
      const assignee = await issue.assignee;
      const creator = await issue.creator;
      const team = await issue.team;
      const project = await issue.project;
      const labels = await issue.labels();
      const attachments = await issue.attachments();
      
      return this.mapIssueToLinearIssue({
        ...issue,
        state,
        assignee,
        creator,
        team,
        project,
        labels,
        attachments,
      });
    } catch (error) {
      this.logger.error(`Failed to fetch issue ${issueId}:`, error);
      return null;
    }
  }

  async searchIssues(query: string, limit: number = 20): Promise<LinearIssue[]> {
    try {
      this.logApiCall('searchIssues');
      
      // Use a single GraphQL query for search as well
      const searchQuery = `
        query SearchIssues($query: String!, $includeArchived: Boolean, $first: Int) {
          searchIssues(query: $query, includeArchived: $includeArchived, first: $first) {
            nodes {
              ... on Issue {
                id
                identifier
                title
                description
                priority
                dueDate
                createdAt
                updatedAt
                url
                state {
                  id
                  name
                  type
                  color
                }
                assignee {
                  id
                  name
                  email
                }
                creator {
                  id
                  name
                  email
                }
                team {
                  id
                  name
                  key
                }
                project {
                  id
                  name
                }
                labels {
                  nodes {
                    id
                    name
                    color
                  }
                }
                attachments {
                  nodes {
                    id
                    title
                    url
                  }
                }
              }
            }
          }
        }
      `;

      const variables = {
        query,
        includeArchived: false,
        first: limit,
      };

      const response = await (this.client as any).client.rawRequest(searchQuery, variables);
      const searchResults = response.data.searchIssues;

      // Map the response to our LinearIssue interface
      const mappedIssues = searchResults.nodes.map((issue: any) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        priority: {
          value: issue.priority || 0,
          name: this.getPriorityName(issue.priority || 0),
        },
        dueDate: issue.dueDate,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        url: issue.url,
        status: issue.state?.name || 'Unknown',
        assignee: issue.assignee,
        assigneeId: issue.assignee?.id,
        createdBy: issue.creator?.name || issue.creator?.email || 'Unknown',
        createdById: issue.creator?.id || '',
        team: issue.team?.name || 'Unknown',
        teamId: issue.team?.id || '',
        project: issue.project?.name,
        projectId: issue.project?.id,
        labels: issue.labels?.nodes || [],
        attachments: issue.attachments?.nodes || [],
      }));

      return mappedIssues;
    } catch (error) {
      this.logger.error('Failed to search issues:', error);
      throw new Error('Failed to search issues');
    }
  }

  async listMyIssues(userId: string, limit: number = 20): Promise<LinearIssue[]> {
    try {
      // Use the optimized listIssues method with assignee filter
      return await this.listIssues({
        assigneeId: userId,
        limit,
        includeArchived: false,
      });
    } catch (error) {
      this.logger.error('Failed to fetch user issues:', error);
      throw new Error('Failed to fetch user issues');
    }
  }

  async getUrgentIssues(): Promise<LinearIssue[]> {
    return this.listIssues({ priority: 1, limit: 20 });
  }

  async updateIssueStatus(issueId: string, stateId: string): Promise<boolean> {
    try {
      await this.client.updateIssue(issueId, { stateId });
      this.logger.info(`Updated issue ${issueId} status to ${stateId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update issue ${issueId} status:`, error);
      return false;
    }
  }

  async updateIssueAssignee(issueId: string, assigneeId: string): Promise<boolean> {
    try {
      await this.client.updateIssue(issueId, { assigneeId });
      this.logger.info(`Updated issue ${issueId} assignee to ${assigneeId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update issue ${issueId} assignee:`, error);
      return false;
    }
  }

  async updateIssuePriority(issueId: string, priority: number): Promise<boolean> {
    try {
      await this.client.updateIssue(issueId, { priority });
      this.logger.info(`Updated issue ${issueId} priority to ${priority}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update issue ${issueId} priority:`, error);
      return false;
    }
  }

  async addComment(issueId: string, body: string): Promise<LinearComment | null> {
    try {
      const commentPayload = await this.client.createComment({
        issueId,
        body,
      });
      const comment = await commentPayload.comment;
      
      if (!comment) return null;

      return {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        user: {
          id: (comment.user as any)?.id || '',
          name: (comment.user as any)?.name || 'Unknown',
          email: (comment.user as any)?.email,
        },
        issue: {
          id: (comment.issue as any)?.id || '',
          identifier: (comment.issue as any)?.identifier || '',
        },
      };
    } catch (error) {
      this.logger.error(`Failed to add comment to issue ${issueId}:`, error);
      return null;
    }
  }

  async listComments(issueId: string): Promise<LinearComment[]> {
    try {
      const issue = await this.client.issue(issueId);
      if (!issue) return [];

      const comments = await issue.comments();
      return comments.nodes.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        user: {
          id: (comment.user as any)?.id || '',
          name: (comment.user as any)?.name || 'Unknown',
          email: (comment.user as any)?.email,
        },
        issue: {
          id: issue.id,
          identifier: issue.identifier,
        },
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch comments for issue ${issueId}:`, error);
      return [];
    }
  }

  async listProjects(teamId?: string): Promise<LinearProject[]> {
    try {
      const projects = await this.client.projects({
        filter: teamId ? { accessibleTeams: { some: { id: { eq: teamId } } } } as any : undefined,
        orderBy: 'updatedAt' as any,
      });

      return projects.nodes.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        url: project.url,
        state: project.state,
        progress: project.progress,
        startDate: project.startDate,
        targetDate: project.targetDate,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        lead: project.lead ? {
          id: (project.lead as any)?.id || '',
          name: (project.lead as any)?.name || 'Unknown',
        } : undefined,
        issues: {
          totalCount: 0, // Will be populated separately if needed
        },
        teams: {
          nodes: [],
        },
      }));
    } catch (error) {
      this.logger.error('Failed to fetch projects:', error);
      throw new Error('Failed to fetch projects');
    }
  }

  async getProject(projectId: string): Promise<LinearProject | null> {
    try {
      const project = await this.client.project(projectId);
      if (!project) return null;

      const teams = await project.teams();
      const issues = await project.issues();

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        url: project.url,
        state: project.state,
        progress: project.progress,
        startDate: project.startDate,
        targetDate: project.targetDate,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        lead: project.lead ? {
          id: (project.lead as any)?.id || '',
          name: (project.lead as any)?.name || 'Unknown',
        } : undefined,
        issues: {
          totalCount: issues.nodes.length,
        },
        teams: {
          nodes: teams.nodes.map((team) => ({
            id: team.id,
            name: team.name,
            description: team.description,
            key: team.key,
            private: team.private,
            createdAt: team.createdAt.toISOString(),
            updatedAt: team.updatedAt.toISOString(),
            issueCount: 0,
            cycleEnabled: team.cyclesEnabled || false,
            members: { nodes: [] },
          })),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch project ${projectId}:`, error);
      return null;
    }
  }

  async listTeams(): Promise<LinearTeam[]> {
    try {
      const teams = await this.client.teams();
      
      return teams.nodes.map((team) => ({
        id: team.id,
        name: team.name,
        description: team.description,
        key: team.key,
        private: team.private,
        createdAt: team.createdAt.toISOString(),
        updatedAt: team.updatedAt.toISOString(),
        issueCount: 0, // Will be populated separately if needed
        cycleEnabled: team.cyclesEnabled || false,
        members: { nodes: [] },
      }));
    } catch (error) {
      this.logger.error('Failed to fetch teams:', error);
      throw new Error('Failed to fetch teams');
    }
  }

  async getTeam(teamId: string): Promise<LinearTeam | null> {
    try {
      const team = await this.client.team(teamId);
      if (!team) return null;

      const members = await team.members();
      const issues = await team.issues({ includeArchived: false });

      return {
        id: team.id,
        name: team.name,
        description: team.description,
        key: team.key,
        private: team.private,
        createdAt: team.createdAt.toISOString(),
        updatedAt: team.updatedAt.toISOString(),
        issueCount: issues.nodes.length,
        cycleEnabled: team.cyclesEnabled || false,
        members: {
          nodes: members.nodes.map((member) => ({
            id: member.id,
            name: member.name,
            displayName: member.displayName,
            email: member.email,
            avatarUrl: member.avatarUrl,
            active: member.active,
            admin: member.admin,
            createdAt: member.createdAt.toISOString(),
            updatedAt: member.updatedAt.toISOString(),
          })),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch team ${teamId}:`, error);
      return null;
    }
  }

  async listUsers(teamId?: string): Promise<LinearUser[]> {
    try {
      let users;
      if (teamId) {
        const team = await this.client.team(teamId);
        const members = await team.members();
        users = members.nodes;
      } else {
        const allUsers = await this.client.users();
        users = allUsers.nodes;
      }

      return users.map((user) => ({
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        active: user.active,
        admin: user.admin,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      }));
    } catch (error) {
      this.logger.error('Failed to fetch users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  async listIssueStatuses(teamId: string): Promise<LinearIssueStatus[]> {
    try {
      const team = await this.client.team(teamId);
      const states = await team.states();

      return states.nodes.map((state) => ({
        id: state.id,
        name: state.name,
        type: state.type,
        position: state.position,
        color: state.color,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch issue statuses:', error);
      throw new Error('Failed to fetch issue statuses');
    }
  }

  async listIssueLabels(teamId: string): Promise<LinearLabel[]> {
    try {
      const team = await this.client.team(teamId);
      const labels = await team.labels();

      return labels.nodes.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch issue labels:', error);
      throw new Error('Failed to fetch issue labels');
    }
  }

  // Helper method to map Linear SDK issue to our LinearIssue type
  private mapIssueToLinearIssue(issue: any): LinearIssue {
    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      priority: {
        value: issue.priority,
        name: this.getPriorityName(issue.priority),
      },
      url: issue.url,
      gitBranchName: issue.branchName,
      createdAt: issue.createdAt.toISOString(),
      updatedAt: issue.updatedAt.toISOString(),
      dueDate: issue.dueDate,
      status: issue.state?.name || 'Unknown',
      labels: issue.labels?.nodes?.map((label: any) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
      })) || [],
      attachments: issue.attachments?.nodes?.map((attachment: any) => ({
        id: attachment.id,
        title: attachment.title,
        subtitle: attachment.subtitle,
        url: attachment.url,
      })) || [],
      createdBy: issue.creator?.name || 'Unknown',
      createdById: issue.creator?.id || '',
      assignee: issue.assignee?.name,
      assigneeId: issue.assignee?.id,
      project: issue.project?.name,
      projectId: issue.project?.id,
      team: issue.team?.name || '',
      teamId: issue.team?.id || '',
      parentId: issue.parent?.id,
      estimate: issue.estimate,
    };
  }

}