import { LinearIssue, LinearComment, LinearProject, LinearTeam } from '../types';

export const BUG_TEMPLATE = `**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Environment:**
- Platform: [Web/iOS/Android]
- Version: [App version]
- User Type: [Customer/Admin/etc]

**Additional Context:**
[Any other relevant information]`;

export const FEATURE_TEMPLATE = `**User Story:**
As a [type of user], I want [feature] so that [benefit].

**Business Value:**
[Why this matters to the business]

**Success Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Dependencies:**
[Any blockers or requirements]

**Acceptance Criteria:**
[How we'll know this is complete]`;

export function formatTicketSummary(ticketData: any): string {
  const priorityEmojis: Record<string, string> = {
    Urgent: '🔴',
    High: '🟠',
    Medium: '🟡',
    Low: '🟢',
  };

  const labelEmojis: Record<string, string> = {
    Bug: '🐛',
    Improvement: '💡',
    Request: '📋',
  };

  return `
*📋 Ticket Summary*

*Title:* ${ticketData.title}

*Label:* ${labelEmojis[ticketData.label] || ''} ${ticketData.label}

*Priority:* ${priorityEmojis[ticketData.priority] || ''} ${ticketData.priority}

*Description:*
${ticketData.description}

*Assignee:* Regina
*Project:* Request Tickets
  `.trim();
}

export function formatIssueList(issues: LinearIssue[]): string {
  if (issues.length === 0) {
    return '📋 No issues found.';
  }

  const priorityEmojis: Record<string, string> = {
    'Urgent': '🔴',
    'High': '🟠',
    'Medium': '🟡',
    'Low': '🟢',
    'No priority': '⚪',
  };

  // Separate grouping for better organization
  const urgentIssues: LinearIssue[] = [];
  const highPriorityIssues: LinearIssue[] = [];
  const inProgressIssues: LinearIssue[] = [];
  const todoIssues: LinearIssue[] = [];
  const completedIssues: LinearIssue[] = [];

  // Categorize issues
  issues.forEach(issue => {
    const status = issue.status?.toLowerCase() || '';
    const priority = issue.priority.name;
    
    if (status === 'done' || status === 'completed' || status === 'closed' || status === 'canceled') {
      completedIssues.push(issue);
    } else if (status.includes('progress') || status.includes('qa') || status.includes('testing') || status.includes('review') || status.includes('ready')) {
      inProgressIssues.push(issue);
    } else if (priority === 'Urgent') {
      urgentIssues.push(issue);
    } else if (priority === 'High') {
      highPriorityIssues.push(issue);
    } else {
      todoIssues.push(issue);
    }
  });

  let message = '*📋 Latest Tickets*\n';
  let ticketNumber = 1;

  // Helper function to format a group of issues
  const formatGroup = (groupName: string, groupIssues: LinearIssue[], emoji?: string) => {
    if (groupIssues.length === 0) return '';
    
    let groupMessage = `\n━━━━━━━━━━━━━━━━━━━━━\n`;
    groupMessage += `*${emoji || ''}${groupName}*\n`;
    
    for (const issue of groupIssues) {
      const assignee = formatAssigneeName(issue.assignee);
      const dueDate = issue.dueDate ? ` (Due: ${new Date(issue.dueDate).toLocaleDateString()})` : '';
      const priorityEmoji = priorityEmojis[issue.priority.name] || '';
      
      // Extract prefix from title if it exists (e.g., [App], [Backend])
      let title = issue.title;
      const prefixMatch = title.match(/^\[(.*?)\]\s*/);
      if (prefixMatch) {
        title = title.substring(prefixMatch[0].length);
      }
      
      groupMessage += `\n${ticketNumber}. ${priorityEmoji} *${issue.identifier}* -`;
      if (prefixMatch) {
        groupMessage += ` [${prefixMatch[1]}]`;
      }
      groupMessage += ` ${title}`;
      groupMessage += `\n   └ ${issue.status}`;
      if (assignee !== 'Unassigned') {
        groupMessage += ` • ${assignee}`;
      }
      if (dueDate) {
        groupMessage += ` ${dueDate}`;
      }
      groupMessage += '\n';
      ticketNumber++;
    }
    
    return groupMessage;
  };

  // Add each group with proper formatting
  message += formatGroup('URGENT PRIORITY', urgentIssues, '🚨 ');
  message += formatGroup('HIGH PRIORITY', highPriorityIssues, '⚠️ ');
  message += formatGroup('IN PROGRESS / TESTING', inProgressIssues, '🔄 ');
  message += formatGroup('TODO / BACKLOG', todoIssues, '📝 ');
  message += formatGroup('COMPLETED', completedIssues, '✅ ');

  // Add summary at the end
  const totalCount = issues.length;
  const urgentCount = urgentIssues.length;
  const inProgressCount = inProgressIssues.length;
  
  message += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 *Summary:* ${totalCount} total tickets\n`;
  if (urgentCount > 0) {
    message += `⚡ ${urgentCount} urgent items need attention\n`;
  }
  if (inProgressCount > 0) {
    message += `🏃 ${inProgressCount} items in progress\n`;
  }

  return message.trim();
}

function formatAssigneeName(assignee?: string | { name?: string; email?: string }): string {
  if (!assignee) return 'Unassigned';
  
  // Handle object format (from new GraphQL query)
  if (typeof assignee === 'object') {
    const name = assignee.name || assignee.email || 'Unassigned';
    // Remove email domain if using email as name
    const emailIndex = name.indexOf('@');
    if (emailIndex > -1) {
      return name.substring(0, emailIndex);
    }
    return name;
  }
  
  // Handle string format (legacy)
  // Remove email domain if present
  const emailIndex = assignee.indexOf('@');
  if (emailIndex > -1) {
    return assignee.substring(0, emailIndex);
  }
  
  // Capitalize first letter
  return assignee.charAt(0).toUpperCase() + assignee.slice(1);
}

export function formatIssueDetail(issue: LinearIssue, comments: LinearComment[] = []): string {
  const priorityEmojis: Record<string, string> = {
    'Urgent': '🔴',
    'High': '🟠',
    'Medium': '🟡',
    'Low': '🟢',
    'No priority': '⚪',
  };

  const priorityEmoji = priorityEmojis[issue.priority.name] || '⚪';
  const labels = issue.labels.map(l => `🏷️ ${l.name}`).join(' ');
  
  let message = `*🎫 ${issue.identifier}: ${issue.title}*\n\n`;
  
  message += `*Priority:* ${priorityEmoji} ${issue.priority.name}\n`;
  message += `*Status:* ${issue.status}\n`;
  message += `*Assignee:* ${formatAssigneeName(issue.assignee)}\n`;
  
  if (issue.project) {
    message += `*Project:* ${issue.project}\n`;
  }
  
  if (labels) {
    message += `*Labels:* ${labels}\n`;
  }
  
  if (issue.dueDate) {
    const dueDate = new Date(issue.dueDate);
    const isOverdue = dueDate < new Date();
    message += `*Due Date:* ${isOverdue ? '⚠️ ' : ''}${dueDate.toLocaleDateString()}\n`;
  }
  
  message += `\n*Description:*\n${issue.description || 'No description provided.'}\n`;
  
  if (comments.length > 0) {
    message += `\n*💬 Comments (${comments.length}):*\n`;
    const recentComments = comments.slice(-3);
    for (const comment of recentComments) {
      const commentDate = new Date(comment.createdAt).toLocaleString();
      message += `\n*${comment.user.name}* - ${commentDate}\n${comment.body}\n`;
    }
    if (comments.length > 3) {
      message += `\n_...and ${comments.length - 3} more comments_\n`;
    }
  }
  
  if (issue.attachments.length > 0) {
    message += `\n*📎 Attachments:* ${issue.attachments.length} file(s)\n`;
  }
  
  message += `\n*🔗 Linear URL:* ${issue.url}`;
  
  return message;
}

export function formatProjectList(projects: LinearProject[]): string {
  if (projects.length === 0) {
    return '📁 No projects found.';
  }

  let message = '*📁 Projects*\n\n';
  
  for (const project of projects) {
    const progressPercent = Math.round(project.progress * 100);
    const progressBar = Math.round(project.progress * 10);
    const progress = '█'.repeat(progressBar) + '░'.repeat(10 - progressBar);
    
    message += `*${project.name}*\n`;
    message += `Progress: [${progress}] ${progressPercent}%\n`;
    
    if (project.lead) {
      message += `Lead: ${project.lead.name}\n`;
    }
    
    if (project.targetDate) {
      const targetDate = new Date(project.targetDate);
      const daysRemaining = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      message += `Target: ${targetDate.toLocaleDateString()} (${daysRemaining} days)\n`;
    }
    
    message += '\n';
  }
  
  return message.trim();
}

export function formatTeamList(teams: LinearTeam[]): string {
  if (teams.length === 0) {
    return '👥 No teams found.';
  }

  let message = '*👥 Teams*\n\n';
  
  for (const team of teams) {
    message += `*${team.name}* (${team.key})\n`;
    
    if (team.description) {
      message += `${team.description}\n`;
    }
    
    if (team.members?.nodes?.length > 0) {
      message += `Members: ${team.members.nodes.length}\n`;
    }
    
    if (typeof team.issueCount === 'number') {
      message += `Active Issues: ${team.issueCount}\n`;
    }
    
    message += '\n';
  }
  
  return message.trim();
}

export function formatUserWorkload(user: string, issues: LinearIssue[]): string {
  const priorityEmojis: Record<string, string> = {
    'Urgent': '🔴',
    'High': '🟠',
    'Medium': '🟡',
    'Low': '🟢',
    'No priority': '⚪',
  };

  const byStatus = issues.reduce((acc, issue) => {
    const status = issue.status || 'Unknown';
    if (!acc[status]) acc[status] = [];
    acc[status].push(issue);
    return acc;
  }, {} as Record<string, LinearIssue[]>);

  let message = `*👤 ${user}'s Workload*\n\n`;
  message += `Total Issues: ${issues.length}\n\n`;

  for (const [status, statusIssues] of Object.entries(byStatus)) {
    message += `*${status} (${statusIssues.length})*\n`;
    for (const issue of statusIssues) {
      const emoji = priorityEmojis[issue.priority.name] || '⚪';
      message += `${emoji} ${issue.identifier}: ${issue.title}\n`;
    }
    message += '\n';
  }

  return message.trim();
}