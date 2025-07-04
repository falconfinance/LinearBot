import TelegramBot, { CallbackQuery } from 'node-telegram-bot-api';
import { Database } from '../../db/database';
import { SessionManager } from '../sessionManager';
import { LinearService } from '../../api/linearService';
import { logger as Logger } from '../../utils/logger';
import { SessionState, TicketLabel, TicketPriority, TicketStatus, LinearIssue } from '../../types';
import { config } from '../../config';
import { 
  getMainMenuKeyboard,
  getLabelKeyboard, 
  getPriorityKeyboard, 
  getConfirmationKeyboard,
  getEditKeyboard,
  getTemplateKeyboard 
} from '../keyboards';
import { formatTicketSummary, BUG_TEMPLATE, FEATURE_TEMPLATE } from '../templates';

export class CallbackHandler {
  constructor(
    private bot: TelegramBot,
    private db: Database,
    private sessionManager: SessionManager,
    private linearService: LinearService,
    private logger: typeof Logger
  ) {}

  async handleCallback(query: CallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;
    const userId = query.from.id.toString();
    const data = query.data;

    if (!chatId || !messageId || !data) {
      return;
    }

    try {
      // Answer callback to remove loading state
      await this.bot.answerCallbackQuery(query.id);

      // Check if user is authenticated
      const user = await this.db.getUserById(userId);
      if (!user || !user.is_authenticated) {
        await this.bot.editMessageText(
          '🔒 You need to authenticate first.\n\nPlease use /start to begin.',
          { chat_id: chatId, message_id: messageId }
        );
        return;
      }

      // Parse callback data
      const [action, ...valueParts] = data.split(':');
      const value = valueParts.join(':'); // Rejoin in case value contains colons

      switch (action) {
        case 'action':
          await this.handleAction(chatId, messageId, userId, value);
          break;
          
        case 'category':
          await this.handleCategorySelection(chatId, messageId, userId, value as TicketLabel);
          break;
          
        case 'label':
          await this.handleLabelSelection(chatId, messageId, userId, value as TicketLabel);
          break;
          
        case 'priority':
          await this.handlePrioritySelection(chatId, messageId, userId, value as TicketPriority);
          break;
          
        case 'confirm':
          await this.handleConfirmation(chatId, messageId, userId, value, user);
          break;
          
        case 'edit':
          await this.handleEdit(chatId, messageId, userId, value);
          break;
          
        case 'template':
          await this.handleTemplate(chatId, messageId, userId, value);
          break;
          
        case 'cmd':
          await this.handleCommand(chatId, messageId, userId, value);
          break;
          
        case 'main_menu':
          await this.handleMainMenu(chatId, messageId, userId);
          break;
          
        // Linear-specific callback actions
        case 'view_issue':
          await this.handleViewIssue(chatId, messageId, userId, value);
          break;
          
        case 'next_page':
        case 'prev_page':
          await this.handlePagination(chatId, messageId, userId, action, value);
          break;
          
        case 'filter_priority':
          await this.handleFilterPriority(chatId, messageId, userId, value);
          break;
          
        case 'view_project':
          await this.handleViewProject(chatId, messageId, userId, value);
          break;
          
        case 'view_team':
          await this.handleViewTeam(chatId, messageId, userId, value);
          break;
          
        case 'update_status':
          await this.handleUpdateStatus(chatId, messageId, userId, value);
          break;
          
        case 'assign_issue':
          await this.handleAssignIssue(chatId, messageId, userId, value);
          break;
          
        case 'add_comment':
          await this.handleAddComment(chatId, messageId, userId, value);
          break;
          
        case 'set_status':
          await this.handleSetStatus(chatId, messageId, userId, value);
          break;
          
        case 'assign_to':
          await this.handleAssignTo(chatId, messageId, userId, value);
          break;
          
        case 'cancel_status_update':
        case 'cancel_assign':
          await this.handleCancel(chatId, messageId, userId);
          break;
          
        default:
          this.logger.warn(`Unknown callback action: ${action} (full data: ${data})`);
      }
    } catch (error) {
      this.logger.error('Error handling callback:', error);
      await this.bot.editMessageText(
        'Sorry, an error occurred. Please try again.',
        { chat_id: chatId, message_id: messageId }
      );
    }
  }

  private async handleAction(chatId: number, messageId: number, userId: string, action: string): Promise<void> {
    switch (action) {
      case 'create_ticket':
        // Check rate limit
        const ticketsToday = await this.db.getUserTicketsToday(userId);
        if (ticketsToday >= config.rateLimit.maxTicketsPerDay) {
          await this.bot.editMessageText(
            `❌ You've reached your daily limit of ${config.rateLimit.maxTicketsPerDay} tickets.\n\n` +
            'Please try again tomorrow or contact Regina directly for urgent requests.',
            { chat_id: chatId, message_id: messageId }
          );
          return;
        }

        // Start ticket creation flow with category selection
        await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_CATEGORY);
        await this.bot.editMessageText(
          '📝 *Creating New Ticket*\n\n' +
          'Please select the category that best describes your request:',
          { 
            chat_id: chatId, 
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🐛 Bug', callback_data: 'category:Bug' }],
                [{ text: '💡 Improvement Suggestion', callback_data: 'category:Improvement' }],
                [{ text: '📋 Request', callback_data: 'category:Request' }],
                [{ text: '❌ Cancel', callback_data: 'main_menu' }]
              ]
            }
          }
        );
        break;

      case 'view_guidelines':
        await this.bot.editMessageText(
          '*📚 Ticket Creation Guidelines*\n\n' +
          '*Good Title Examples:*\n' +
          '• "Fix login error on mobile app"\n' +
          '• "Add export to CSV feature"\n' +
          '• "Update dashboard color scheme"\n\n' +
          '*Good Description Should Include:*\n' +
          '• Clear explanation of what\'s needed\n' +
          '• Why it\'s important\n' +
          '• Who will benefit\n' +
          '• Any relevant context or deadlines\n\n' +
          '*Priority Guide:*\n' +
          '🔴 *Urgent* - Blocking critical work\n' +
          '🟠 *High* - Needed within this week\n' +
          '🟡 *Medium* - Can wait for next sprint\n' +
          '🟢 *Low* - Nice to have eventually',
          { 
            chat_id: chatId, 
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getMainMenuKeyboard()
          }
        );
        break;

      case 'contact_support':
        await this.bot.editMessageText(
          '*💬 Contact Support*\n\n' +
          'For help with the bot:\n' +
          '• Slack: #linear-bot-help\n' +
          '• Direct message to tech team\n\n' +
          'For urgent ticket requests:\n' +
          '• Contact Regina directly\n' +
          '• Email: support@falconprotocol.io',
          { 
            chat_id: chatId, 
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getMainMenuKeyboard()
          }
        );
        break;
    }
  }

  private async handleCategorySelection(chatId: number, messageId: number, userId: string, category: TicketLabel): Promise<void> {
    // Save category as label
    await this.sessionManager.updateTicketData(userId, { label: category });
    await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_TITLE);
    
    await this.bot.editMessageText(
      `✅ Category selected: ${category}\n\n` +
      'Now, please provide a clear title for your request:\n\n' +
      '*Example:* "Add dark mode toggle to settings"\n\n' +
      'Type your title below (10-100 characters):',
      { 
        chat_id: chatId, 
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );
  }

  private async handleLabelSelection(chatId: number, messageId: number, userId: string, label: TicketLabel): Promise<void> {
    await this.sessionManager.updateTicketData(userId, { label });
    await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_PRIORITY);

    // Check if we should offer a template
    const templateKeyboard = getTemplateKeyboard(label);
    
    if (templateKeyboard) {
      await this.bot.editMessageText(
        `✅ Label selected: ${label}\n\n` +
        'Would you like to use a template for your description?',
        { 
          chat_id: chatId, 
          message_id: messageId,
          reply_markup: templateKeyboard
        }
      );
    } else {
      // Skip template, go to priority
      await this.bot.editMessageText(
        `✅ Label selected: ${label}\n\n` +
        'Now, please select the priority level:',
        { 
          chat_id: chatId, 
          message_id: messageId,
          reply_markup: getPriorityKeyboard()
        }
      );
    }
  }

  private async handlePrioritySelection(chatId: number, messageId: number, userId: string, priority: TicketPriority): Promise<void> {
    await this.sessionManager.updateTicketData(userId, { priority });
    await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_CONFIRMATION);

    const session = await this.sessionManager.getSession(userId);
    if (!session) return;

    const summary = formatTicketSummary(session.ticketData);

    await this.bot.editMessageText(
      summary + '\n\nPlease review and confirm:',
      { 
        chat_id: chatId, 
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getConfirmationKeyboard()
      }
    );
  }

  private async handleConfirmation(chatId: number, messageId: number, userId: string, action: string, user: any): Promise<void> {
    const session = await this.sessionManager.getSession(userId);
    if (!session) return;

    switch (action) {
      case 'yes':
        // Create ticket
        await this.bot.editMessageText(
          '⏳ Creating your ticket in Linear...',
          { chat_id: chatId, message_id: messageId }
        );

        try {
          // Save ticket to database first
          const ticketRecord = await this.db.createTicket({
            telegram_user_id: userId,
            telegram_username: user.telegram_username,
            department: user.department,
            title: session.ticketData.title!,
            description: session.ticketData.description!,
            label: session.ticketData.label!,
            priority: session.ticketData.priority!,
            status: TicketStatus.SUBMITTED,
          });

          // Create in Linear
          const linearTicket = await this.linearService.createTicket({
            title: session.ticketData.title!,
            description: session.ticketData.description!,
            label: session.ticketData.label!,
            priority: session.ticketData.priority!,
            createdBy: user.full_name,
            department: user.department,
          });

          // Update database with Linear info
          await this.db.updateTicketStatus(
            ticketRecord.id,
            TicketStatus.CREATED,
            linearTicket.id,
            linearTicket.url
          );

          // Update user counters
          await this.db.incrementUserTicketCount(userId);

          // Clear session
          await this.sessionManager.updateSession(userId, {
            state: SessionState.IDLE,
            ticketData: {},
          });

          await this.bot.editMessageText(
            `✅ *Ticket Created Successfully!*\n\n` +
            `*Ticket ID:* ${linearTicket.identifier}\n` +
            `*View in Linear:* [Click here](${linearTicket.url})\n\n` +
            `Your ticket has been assigned to Regina for triaging.\n\n` +
            `What would you like to do next?`,
            { 
              chat_id: chatId, 
              message_id: messageId,
              parse_mode: 'Markdown',
              reply_markup: getMainMenuKeyboard()
            }
          );

          await this.db.addAuditLog(userId, 'TICKET_CREATED', linearTicket.identifier);

          // Notify Regina about the new ticket
          const { config } = await import('../../config');
          if (config.auth.reginaChatId) {
            const notificationMessage = `🎫 *New Ticket Created*\n\n` +
              `*Created by:* ${user.full_name} (${user.department})\n` +
              `*Ticket ID:* ${linearTicket.identifier}\n` +
              `*Title:* ${session.ticketData.title}\n` +
              `*Priority:* ${session.ticketData.priority}\n` +
              `*Label:* ${session.ticketData.label}\n\n` +
              `*View in Linear:* [Click here](${linearTicket.url})`;
            
            await this.bot.sendMessage(config.auth.reginaChatId, notificationMessage, {
              parse_mode: 'Markdown'
            }).catch((err) => {
              this.logger.error('Failed to notify Regina:', err);
            });
          }
        } catch (error) {
          this.logger.error('Failed to create ticket:', error);
          
          // Update ticket status to failed
          if (session.ticketData.id) {
            await this.db.updateTicketStatus(session.ticketData.id, TicketStatus.FAILED);
          }

          await this.bot.editMessageText(
            '❌ Failed to create ticket. Your request has been saved and will be retried.\n\n' +
            'Please try again later or contact support if this persists.',
            { 
              chat_id: chatId, 
              message_id: messageId,
              reply_markup: getMainMenuKeyboard()
            }
          );
        }
        break;

      case 'edit':
        await this.bot.editMessageText(
          'What would you like to edit?',
          { 
            chat_id: chatId, 
            message_id: messageId,
            reply_markup: getEditKeyboard()
          }
        );
        break;

      case 'cancel':
        await this.sessionManager.updateSession(userId, {
          state: SessionState.IDLE,
          ticketData: {},
        });
        
        await this.bot.editMessageText(
          '❌ Ticket creation cancelled.\n\nWhat would you like to do?',
          { 
            chat_id: chatId, 
            message_id: messageId,
            reply_markup: getMainMenuKeyboard()
          }
        );
        break;
    }
  }

  private async handleEdit(chatId: number, messageId: number, userId: string, field: string): Promise<void> {
    const session = await this.sessionManager.getSession(userId);
    if (!session) return;

    switch (field) {
      case 'title':
        await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_TITLE);
        await this.bot.editMessageText(
          'Please enter the new title (10-100 characters):',
          { chat_id: chatId, message_id: messageId }
        );
        break;

      case 'description':
        await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_DESCRIPTION);
        await this.bot.editMessageText(
          'Please enter the new description (minimum 50 characters):',
          { chat_id: chatId, message_id: messageId }
        );
        break;

      case 'label':
        await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_LABEL);
        await this.bot.editMessageText(
          'Please select the new label:',
          { 
            chat_id: chatId, 
            message_id: messageId,
            reply_markup: getLabelKeyboard()
          }
        );
        break;

      case 'priority':
        await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_PRIORITY);
        await this.bot.editMessageText(
          'Please select the new priority:',
          { 
            chat_id: chatId, 
            message_id: messageId,
            reply_markup: getPriorityKeyboard()
          }
        );
        break;

      case 'back':
        await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_CONFIRMATION);
        const summary = formatTicketSummary(session.ticketData);
        await this.bot.editMessageText(
          summary + '\n\nPlease review and confirm:',
          { 
            chat_id: chatId, 
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getConfirmationKeyboard()
          }
        );
        break;
    }
  }

  private async handleTemplate(chatId: number, messageId: number, userId: string, action: string): Promise<void> {
    if (action === 'skip') {
      // Continue to priority selection
      await this.bot.editMessageText(
        'Now, please select the priority level:',
        { 
          chat_id: chatId, 
          message_id: messageId,
          reply_markup: getPriorityKeyboard()
        }
      );
    } else {
      // Show template
      const session = await this.sessionManager.getSession(userId);
      if (!session) return;

      const template = action === 'bug' ? BUG_TEMPLATE : FEATURE_TEMPLATE;
      
      await this.sessionManager.updateTicketData(userId, { awaitingTemplate: true });
      
      await this.bot.editMessageText(
        `Here's a template for your ${action} report. Please fill it out:\n\n` +
        `\`\`\`\n${template}\n\`\`\`\n\n` +
        'Copy the template above, fill in the details, and send it back.',
        { 
          chat_id: chatId, 
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );
    }
  }

  private async handleMainMenu(chatId: number, messageId: number, userId: string): Promise<void> {
    const user = await this.db.getUserById(userId);
    const fullName = user?.full_name || 'User';
    
    await this.bot.editMessageText(
      `Welcome back ${fullName}! 👋\n\n` +
      `*Quick Command Reference:*\n` +
      `• \`/tickets\` - View recent tickets\n` +
      `• \`/urgent\` - View urgent tickets\n` +
      `• \`/search\` - Search tickets\n` +
      `• \`/projects\` - View projects\n` +
      `• \`/help\` - Full command list\n\n` +
      'What would you like to do?',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: getMainMenuKeyboard(),
      }
    );
  }

  private async handleCommand(chatId: number, messageId: number, userId: string, command: string): Promise<void> {
    // Delete the message with the menu
    await this.bot.deleteMessage(chatId, messageId);
    
    // Create a fake message object to pass to command handlers
    const msg = {
      chat: { id: chatId },
      from: { id: parseInt(userId) },
      message_id: messageId,
    } as any;

    // Import command handler to execute commands
    const { CommandHandler } = await import('./commandHandler');
    const commandHandler = new CommandHandler(
      this.bot,
      this.db,
      this.sessionManager,
      this.linearService,
      this.logger
    );

    // Execute the appropriate command
    switch (command) {
      case 'tickets':
        await commandHandler.handleTickets(msg);
        break;
      case 'urgent':
        await commandHandler.handleUrgent(msg);
        break;
      case 'help':
        await commandHandler.handleHelp(msg);
        break;
      case 'projects':
        await commandHandler.handleProjects(msg);
        break;
      case 'teams':
        await commandHandler.handleTeams(msg);
        break;
      default:
        await this.bot.sendMessage(chatId, 'Unknown command. Please try again.');
    }
  }

  private async handleViewIssue(chatId: number, messageId: number, _userId: string, issueId: string): Promise<void> {
    try {
      // Fetch issue details
      const issue = await this.linearService.getIssue(issueId);
      if (!issue) {
        await this.bot.editMessageText('Issue not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      // Fetch comments
      const comments = await this.linearService.listComments(issueId);
      
      // Import templates
      const { formatIssueDetail } = await import('../templates');
      const message = formatIssueDetail(issue, comments);
      
      const keyboard = {
        inline_keyboard: [
          [
            { text: '📝 Update Status', callback_data: `update_status:${issue.id}` },
            { text: '👤 Assign', callback_data: `assign_issue:${issue.id}` },
          ],
          [
            { text: '💬 Add Comment', callback_data: `add_comment:${issue.id}` },
            { text: '🔗 Open in Linear', url: issue.url },
          ],
          [
            { text: '🔙 Back to List', callback_data: 'cmd:tickets' },
          ],
        ],
      };

      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error viewing issue:', error);
      await this.bot.editMessageText('Failed to load issue details.', { chat_id: chatId, message_id: messageId });
    }
  }

  private issueCache: Map<string, { issues: LinearIssue[], timestamp: number }> = new Map();
  private CACHE_TTL = 60000; // 1 minute cache

  private async getCachedIssues(filters: any): Promise<LinearIssue[]> {
    const cacheKey = JSON.stringify(filters);
    const cached = this.issueCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.issues;
    }
    
    // Fetch fresh data
    const issues = await this.linearService.listIssues(filters);
    this.issueCache.set(cacheKey, { issues, timestamp: Date.now() });
    
    // Clean old cache entries
    if (this.issueCache.size > 10) {
      const oldestKey = Array.from(this.issueCache.keys())[0];
      this.issueCache.delete(oldestKey);
    }
    
    return issues;
  }

  private async handlePagination(chatId: number, messageId: number, _userId: string, _direction: string, value: string): Promise<void> {
    try {
      const [type, pageStr] = value.split(':');
      const page = parseInt(pageStr) || 0;
      
      if (type === 'issues') {
        // Only fetch the page we need
        const pageSize = 5;
        const offset = page * pageSize;
        
        // First, get total count with minimal data
        const allIssues = await this.getCachedIssues({ limit: 100 });
        const totalCount = allIssues.length;
        
        // Get only the issues for the current page
        const pageIssues = allIssues.slice(offset, offset + pageSize);
        
        const { formatIssueList } = await import('../templates');
        const { getIssueListKeyboard } = await import('../keyboards');
        
        // Format only the current page's issues
        let message = `*📋 Latest Tickets (Page ${page + 1})*\n\n`;
        if (pageIssues.length === 0) {
          message += 'No tickets found on this page.';
        } else {
          message += formatIssueList(pageIssues);
          
          // Add page info at the bottom
          const totalPages = Math.ceil(totalCount / pageSize);
          message += `\n\n_Page ${page + 1} of ${totalPages} • Showing ${offset + 1}-${Math.min(offset + pageSize, totalCount)} of ${totalCount} tickets_`;
        }
        
        // Pass total count info to keyboard
        const keyboard = getIssueListKeyboard(pageIssues, page, totalCount > (page + 1) * pageSize);
        
        await this.bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      }
    } catch (error) {
      this.logger.error('Error handling pagination:', error);
      await this.bot.editMessageText('Failed to navigate pages.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleFilterPriority(chatId: number, messageId: number, _userId: string, priority: string): Promise<void> {
    try {
      const priorityNum = parseInt(priority);
      const allIssues = await this.linearService.listIssues({ priority: priorityNum, limit: 50 });
      
      // Get first page of filtered issues
      const pageSize = 5;
      const firstPageIssues = allIssues.slice(0, pageSize);
      
      const { formatIssueList } = await import('../templates');
      const { getIssueListKeyboard } = await import('../keyboards');
      
      const priorityNames = ['No priority', 'Urgent', 'High', 'Medium', 'Low'];
      let message = `🎯 *${priorityNames[priorityNum]} Priority Tickets*\n\n`;
      
      if (firstPageIssues.length === 0) {
        message += 'No tickets found with this priority.';
      } else {
        message += formatIssueList(firstPageIssues);
        
        // Add page info if there are multiple pages
        if (allIssues.length > pageSize) {
          const totalPages = Math.ceil(allIssues.length / pageSize);
          message += `\n\n_Page 1 of ${totalPages} • Showing 1-${Math.min(pageSize, allIssues.length)} of ${allIssues.length} tickets_`;
        }
      }
      
      const keyboard = getIssueListKeyboard(allIssues, 0, allIssues.length > pageSize);
      
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error filtering by priority:', error);
      await this.bot.editMessageText('Failed to filter tickets.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleViewProject(chatId: number, messageId: number, _userId: string, projectId: string): Promise<void> {
    try {
      const project = await this.linearService.getProject(projectId);
      if (!project) {
        await this.bot.editMessageText('Project not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      const progressPercent = Math.round(project.progress * 100);
      const progressBar = Math.round(project.progress * 10);
      const progress = '█'.repeat(progressBar) + '░'.repeat(10 - progressBar);
      
      let message = `*📁 ${project.name}*\n\n`;
      if (project.description) {
        message += `${project.description}\n\n`;
      }
      message += `*Progress:* [${progress}] ${progressPercent}%\n`;
      
      if (project.lead) {
        message += `*Lead:* ${project.lead.name}\n`;
      }
      
      if (project.startDate) {
        message += `*Start Date:* ${new Date(project.startDate).toLocaleDateString()}\n`;
      }
      
      if (project.targetDate) {
        const targetDate = new Date(project.targetDate);
        const daysRemaining = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        message += `*Target Date:* ${targetDate.toLocaleDateString()} (${daysRemaining} days)\n`;
      }
      
      message += `*Issues:* ${project.issues.totalCount}\n`;
      message += `\n[View in Linear](${project.url})`;
      
      const keyboard = {
        inline_keyboard: [
          [{ text: '🔙 Back to Projects', callback_data: 'cmd:projects' }],
          [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
        ],
      };
      
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error viewing project:', error);
      await this.bot.editMessageText('Failed to load project details.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleViewTeam(chatId: number, messageId: number, _userId: string, teamId: string): Promise<void> {
    try {
      const team = await this.linearService.getTeam(teamId);
      if (!team) {
        await this.bot.editMessageText('Team not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      let message = `*👥 ${team.name} (${team.key})*\n\n`;
      if (team.description) {
        message += `${team.description}\n\n`;
      }
      
      message += `*Members:* ${team.members.nodes.length}\n`;
      message += `*Active Issues:* ${team.issueCount}\n`;
      message += `*Private:* ${team.private ? 'Yes' : 'No'}\n`;
      
      if (team.members.nodes.length > 0) {
        message += `\n*Team Members:*\n`;
        team.members.nodes.slice(0, 10).forEach(member => {
          message += `• ${member.name}${member.admin ? ' (Admin)' : ''}\n`;
        });
        if (team.members.nodes.length > 10) {
          message += `_...and ${team.members.nodes.length - 10} more_\n`;
        }
      }
      
      const keyboard = {
        inline_keyboard: [
          [{ text: '🔙 Back to Teams', callback_data: 'cmd:teams' }],
          [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
        ],
      };
      
      await this.bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error viewing team:', error);
      await this.bot.editMessageText('Failed to load team details.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleUpdateStatus(chatId: number, messageId: number, userId: string, issueId: string): Promise<void> {
    try {
      const issue = await this.linearService.getIssue(issueId);
      if (!issue) {
        await this.bot.editMessageText('Issue not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      const { getStatusSelectionKeyboard } = await import('../keyboards');
      const keyboard = getStatusSelectionKeyboard(issue.status, issue.teamId);
      
      await this.bot.editMessageText(
        `Select new status for *${issue.identifier}: ${issue.title}*\n\nCurrent status: *${issue.status}*`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
      
      // Store issue ID in session for status update
      await this.sessionManager.updateSession(userId, {
        state: 'UPDATING_STATUS' as any,
        ticketData: { issueId },
      });
    } catch (error) {
      this.logger.error('Error initiating status update:', error);
      await this.bot.editMessageText('Failed to update status.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleAssignIssue(chatId: number, messageId: number, userId: string, issueId: string): Promise<void> {
    try {
      // Fetch team members
      const issue = await this.linearService.getIssue(issueId);
      if (!issue) {
        await this.bot.editMessageText('Issue not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      const users = await this.linearService.listUsers(issue.teamId);
      
      const { getUserSelectionKeyboard } = await import('../keyboards');
      const keyboard = getUserSelectionKeyboard(users, 0);
      
      await this.bot.editMessageText(
        `Select assignee for *${issue.identifier}: ${issue.title}*`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
      
      // Store issue ID in session
      await this.sessionManager.updateSession(userId, {
        state: 'ASSIGNING_ISSUE' as any,
        ticketData: { issueId },
      });
    } catch (error) {
      this.logger.error('Error initiating assign:', error);
      await this.bot.editMessageText('Failed to load users.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleAddComment(chatId: number, messageId: number, userId: string, issueId: string): Promise<void> {
    try {
      const issue = await this.linearService.getIssue(issueId);
      if (!issue) {
        await this.bot.editMessageText('Issue not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      await this.bot.editMessageText(
        `💬 *Add Comment to ${issue.identifier}*\n\n${issue.title}\n\nPlease type your comment:`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
        }
      );
      
      // Store issue ID in session
      await this.sessionManager.updateSession(userId, {
        state: 'ADDING_COMMENT' as any,
        ticketData: { issueId },
      });
    } catch (error) {
      this.logger.error('Error initiating comment:', error);
      await this.bot.editMessageText('Failed to add comment.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleSetStatus(chatId: number, messageId: number, userId: string, value: string): Promise<void> {
    try {
      const [teamId, statusName] = value.split(':');
      const session = await this.sessionManager.getSession(userId);
      
      if (!session || !session.ticketData.issueId) {
        await this.bot.editMessageText('Session expired. Please try again.', { chat_id: chatId, message_id: messageId });
        return;
      }

      // Get actual status ID from team
      const statuses = await this.linearService.listIssueStatuses(teamId);
      const status = statuses.find(s => s.name.toLowerCase().includes(statusName.toLowerCase()));
      
      if (!status) {
        await this.bot.editMessageText('Status not found.', { chat_id: chatId, message_id: messageId });
        return;
      }

      // Update issue status
      const success = await this.linearService.updateIssueStatus(session.ticketData.issueId, status.id);
      
      if (success) {
        await this.bot.editMessageText(
          `✅ Status updated to *${status.name}*`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getMainMenuKeyboard(),
          }
        );
      } else {
        await this.bot.editMessageText('Failed to update status.', { chat_id: chatId, message_id: messageId });
      }
      
      // Clear session
      await this.sessionManager.updateSession(userId, {
        state: SessionState.IDLE,
        ticketData: {},
      });
    } catch (error) {
      this.logger.error('Error setting status:', error);
      await this.bot.editMessageText('Failed to update status.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleAssignTo(chatId: number, messageId: number, userId: string, assigneeId: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(userId);
      
      if (!session || !session.ticketData.issueId) {
        await this.bot.editMessageText('Session expired. Please try again.', { chat_id: chatId, message_id: messageId });
        return;
      }

      // Update assignee
      const success = await this.linearService.updateIssueAssignee(session.ticketData.issueId, assigneeId);
      
      if (success) {
        const user = await this.linearService.listUsers().then(users => users.find(u => u.id === assigneeId));
        await this.bot.editMessageText(
          `✅ Assigned to *${user?.name || 'User'}*`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getMainMenuKeyboard(),
          }
        );
      } else {
        await this.bot.editMessageText('Failed to update assignee.', { chat_id: chatId, message_id: messageId });
      }
      
      // Clear session
      await this.sessionManager.updateSession(userId, {
        state: SessionState.IDLE,
        ticketData: {},
      });
    } catch (error) {
      this.logger.error('Error assigning issue:', error);
      await this.bot.editMessageText('Failed to update assignee.', { chat_id: chatId, message_id: messageId });
    }
  }

  private async handleCancel(chatId: number, messageId: number, userId: string): Promise<void> {
    await this.sessionManager.updateSession(userId, {
      state: SessionState.IDLE,
      ticketData: {},
    });
    
    await this.bot.editMessageText(
      'Operation cancelled.',
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: getMainMenuKeyboard(),
      }
    );
  }
}