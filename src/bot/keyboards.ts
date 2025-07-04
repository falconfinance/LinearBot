import { InlineKeyboardMarkup } from 'node-telegram-bot-api';
import { TicketLabel, TicketPriority, LinearIssue, LinearProject, LinearTeam, LinearCallbackAction } from '../types';

export function getMainMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📝 Create New Ticket', callback_data: 'action:create_ticket' },
      ],
      [
        { text: '📋 View Tickets (/tickets)', callback_data: 'cmd:tickets' },
        { text: '🚨 Urgent Tickets (/urgent)', callback_data: 'cmd:urgent' },
      ],
      [
        { text: '📚 View Guidelines', callback_data: 'action:view_guidelines' },
        { text: '💬 Contact Support', callback_data: 'action:contact_support' },
      ],
      [
        { text: '❓ Help (/help)', callback_data: 'cmd:help' },
      ],
    ],
  };
}

export function getLabelKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🐛 Bug', callback_data: `label:${TicketLabel.BUG}` },
      ],
      [
        { text: '💡 Improvement', callback_data: `label:${TicketLabel.IMPROVEMENT}` },
      ],
      [
        { text: '📋 Request', callback_data: `label:${TicketLabel.REQUEST}` },
      ],
    ],
  };
}

export function getPriorityKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🔴 Urgent - Blocking work', callback_data: `priority:${TicketPriority.URGENT}` },
      ],
      [
        { text: '🟠 High - Needed this week', callback_data: `priority:${TicketPriority.HIGH}` },
      ],
      [
        { text: '🟡 Medium - Next sprint', callback_data: `priority:${TicketPriority.MEDIUM}` },
      ],
      [
        { text: '🟢 Low - Nice to have', callback_data: `priority:${TicketPriority.LOW}` },
      ],
    ],
  };
}

export function getConfirmationKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Create Ticket', callback_data: 'confirm:yes' },
        { text: '✏️ Edit', callback_data: 'confirm:edit' },
        { text: '❌ Cancel', callback_data: 'confirm:cancel' },
      ],
    ],
  };
}

export function getEditKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📝 Edit Title', callback_data: 'edit:title' },
        { text: '📄 Edit Description', callback_data: 'edit:description' },
      ],
      [
        { text: '🏷️ Edit Label', callback_data: 'edit:label' },
        { text: '🎯 Edit Priority', callback_data: 'edit:priority' },
      ],
      [
        { text: '⬅️ Back to Review', callback_data: 'edit:back' },
      ],
    ],
  };
}

export function getTemplateKeyboard(label: TicketLabel): InlineKeyboardMarkup | undefined {
  if (label === TicketLabel.BUG) {
    return {
      inline_keyboard: [
        [
          { text: '📝 Use Bug Template', callback_data: 'template:bug' },
          { text: '➡️ Skip Template', callback_data: 'template:skip' },
        ],
      ],
    };
  }
  
  return undefined;
}

export function getIssueListKeyboard(issues: LinearIssue[], currentPage: number = 0, hasMore: boolean = false): InlineKeyboardMarkup {
  const keyboard: any[][] = [];
  
  // Add issue buttons - issues passed are already paginated
  issues.forEach(issue => {
    const priorityEmoji = {
      'Urgent': '🔴',
      'High': '🟠',
      'Medium': '🟡',
      'Low': '🟢',
      'No priority': '⚪',
    }[issue.priority.name] || '⚪';
    
    keyboard.push([{
      text: `${priorityEmoji} ${issue.identifier}: ${issue.title.substring(0, 40)}${issue.title.length > 40 ? '...' : ''}`,
      callback_data: `${LinearCallbackAction.VIEW_ISSUE}:${issue.id}`,
    }]);
  });
  
  // Add navigation buttons
  const navButtons = [];
  if (currentPage > 0) {
    navButtons.push({
      text: '⬅️ Previous',
      callback_data: `${LinearCallbackAction.PREV_PAGE}:issues:${currentPage - 1}`,
    });
  }
  if (hasMore) {
    navButtons.push({
      text: 'Next ➡️',
      callback_data: `${LinearCallbackAction.NEXT_PAGE}:issues:${currentPage + 1}`,
    });
  }
  
  if (navButtons.length > 0) {
    keyboard.push(navButtons);
  }
  
  // Add filter buttons
  keyboard.push([
    { text: '🔴 Urgent Only', callback_data: `${LinearCallbackAction.FILTER_PRIORITY}:1` },
    { text: '🟠 High Priority', callback_data: `${LinearCallbackAction.FILTER_PRIORITY}:2` },
  ]);
  
  // Add back to menu button
  keyboard.push([
    { text: '🔙 Back to Menu', callback_data: 'main_menu' },
  ]);
  
  return { inline_keyboard: keyboard };
}

export function getProjectListKeyboard(projects: LinearProject[]): InlineKeyboardMarkup {
  const keyboard: any[][] = [];
  
  // Add project buttons (max 10)
  const maxProjects = Math.min(projects.length, 10);
  for (let i = 0; i < maxProjects; i++) {
    const project = projects[i];
    const progressBar = Math.round(project.progress * 10);
    const progress = '█'.repeat(progressBar) + '░'.repeat(10 - progressBar);
    
    keyboard.push([{
      text: `📁 ${project.name} [${progress}]`,
      callback_data: `view_project:${project.id}`,
    }]);
  }
  
  // Add back to menu button
  keyboard.push([
    { text: '🔙 Back to Menu', callback_data: 'main_menu' },
  ]);
  
  return { inline_keyboard: keyboard };
}

export function getTeamListKeyboard(teams: LinearTeam[]): InlineKeyboardMarkup {
  const keyboard: any[][] = [];
  
  // Add team buttons
  teams.forEach(team => {
    keyboard.push([{
      text: `👥 ${team.name} (${team.key})`,
      callback_data: `view_team:${team.id}`,
    }]);
  });
  
  // Add back to menu button
  keyboard.push([
    { text: '🔙 Back to Menu', callback_data: 'main_menu' },
  ]);
  
  return { inline_keyboard: keyboard };
}

export function getStatusSelectionKeyboard(_currentStatus: string, teamId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📋 Todo', callback_data: `set_status:${teamId}:todo` },
        { text: '🔄 In Progress', callback_data: `set_status:${teamId}:in_progress` },
      ],
      [
        { text: '👀 In Review', callback_data: `set_status:${teamId}:in_review` },
        { text: '✅ Done', callback_data: `set_status:${teamId}:done` },
      ],
      [
        { text: '🗃️ Backlog', callback_data: `set_status:${teamId}:backlog` },
        { text: '❌ Canceled', callback_data: `set_status:${teamId}:canceled` },
      ],
      [
        { text: '🔙 Cancel', callback_data: 'cancel_status_update' },
      ],
    ],
  };
}

export function getUserSelectionKeyboard(users: Array<{id: string, name: string}>, currentPage: number = 0): InlineKeyboardMarkup {
  const keyboard: any[][] = [];
  const pageSize = 8;
  const startIdx = currentPage * pageSize;
  const endIdx = Math.min(startIdx + pageSize, users.length);
  
  // Add user buttons in pairs
  for (let i = startIdx; i < endIdx; i += 2) {
    const row = [];
    row.push({
      text: `👤 ${users[i].name}`,
      callback_data: `assign_to:${users[i].id}`,
    });
    
    if (i + 1 < endIdx) {
      row.push({
        text: `👤 ${users[i + 1].name}`,
        callback_data: `assign_to:${users[i + 1].id}`,
      });
    }
    
    keyboard.push(row);
  }
  
  // Add navigation buttons
  const navButtons = [];
  if (currentPage > 0) {
    navButtons.push({
      text: '⬅️ Previous',
      callback_data: `${LinearCallbackAction.PREV_PAGE}:users:${currentPage - 1}`,
    });
  }
  if (endIdx < users.length) {
    navButtons.push({
      text: 'Next ➡️',
      callback_data: `${LinearCallbackAction.NEXT_PAGE}:users:${currentPage + 1}`,
    });
  }
  
  if (navButtons.length > 0) {
    keyboard.push(navButtons);
  }
  
  // Add cancel button
  keyboard.push([
    { text: '🔙 Cancel', callback_data: 'cancel_assign' },
  ]);
  
  return { inline_keyboard: keyboard };
}