import TelegramBot, { Message } from 'node-telegram-bot-api';
import { Database } from '../../db/database';
import { SessionManager } from '../sessionManager';
import { logger as Logger } from '../../utils/logger';
import { SessionState, LinearSessionState } from '../../types';
import { getMainMenuKeyboard, getIssueListKeyboard, getProjectListKeyboard, getTeamListKeyboard } from '../keyboards';
import { LinearService } from '../../api/linearService';
import { formatIssueList, formatIssueDetail, formatProjectList, formatTeamList } from '../templates';

export class CommandHandler {
  constructor(
    private bot: TelegramBot,
    private db: Database,
    private sessionManager: SessionManager,
    private linearService: LinearService,
    private logger: typeof Logger
  ) {}

  private async checkAuthentication(userId: string, chatId: number): Promise<boolean> {
    try {
      const user = await this.db.getUserById(userId);
      
      if (!user || !user.is_authenticated) {
        await this.bot.sendMessage(
          chatId,
          '🔒 You need to authenticate first.\n\nPlease use /start to begin.',
          { reply_markup: { remove_keyboard: true } }
        );
        return false;
      }
      
      return true;
    } catch (error) {
      this.logger.error('Error checking authentication:', error);
      await this.bot.sendMessage(
        chatId,
        '⚠️ Authentication check failed. Please try /start again.',
        { reply_markup: { remove_keyboard: true } }
      );
      return false;
    }
  }

  async handleStart(msg: Message, _match: RegExpExecArray | null): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    try {

      // Get user info from Telegram
      const fullName = msg.from?.first_name + (msg.from?.last_name ? ' ' + msg.from.last_name : '');
      const department = 'Falcon'; // Default department for now

      // Check if user exists
      let user = await this.db.getUserById(userId);
      
      if (!user) {
        // Create new user (automatically authenticated now)
        user = await this.db.createUser({
          telegram_user_id: userId,
          telegram_username: msg.from?.username,
          full_name: fullName,
          department: department,
          is_active: true,
          is_authenticated: true,  // Auto-authenticate new users
        });
        
        this.logger.info(`New user registered: ${fullName} from ${department}`);
        await this.db.addAuditLog(userId, 'USER_REGISTERED', `${fullName}_${department}`);
      } else {
        // Update last active and ensure authenticated
        await this.db.updateUserLastActive(userId);
        if (!user.is_authenticated) {
          await this.db.updateUserAuthentication(userId, true);
        }
      }

      // Create or reset session
      await this.sessionManager.deleteSession(userId);
      await this.sessionManager.createSession(userId);

      // Show main menu directly (no password required)
      await this.bot.sendMessage(
        chatId,
        `Welcome ${user ? 'back' : ''} ${fullName}! 👋\n\n` +
        `*Quick Command Reference:*\n` +
        `• \`/tickets\` - View recent tickets\n` +
        `• \`/urgent\` - View urgent tickets\n` +
        `• \`/search\` - Search tickets\n` +
        `• \`/projects\` - View projects\n` +
        `• \`/help\` - Full command list\n\n` +
        'What would you like to do?',
        {
          parse_mode: 'Markdown',
          reply_markup: getMainMenuKeyboard(),
        }
      );
    } catch (error) {
      this.logger.error('Error in start command:', error);
      await this.bot.sendMessage(
        chatId,
        'Sorry, an error occurred. Please try again later.'
      );
    }
  }

  async handleHelp(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId || !(await this.checkAuthentication(userId, chatId))) {
      return;
    }
    
    const helpMessage = `
*🤖 Falcon Linear Bot - Complete Guide*

*📋 Ticket Management Commands*
• \`/tickets\` - View recent tickets organized by priority
• \`/mytickets\` - View tickets assigned to you
• \`/ticket FAL-123\` - View detailed ticket information
• \`/urgent\` - Quick access to all urgent priority tickets
• \`/search bug in login\` - Search tickets by keywords
• \`/comment FAL-123 Fixed\` - Add a comment to any ticket

*📁 Organization Commands*
• \`/projects\` - List all projects with progress bars
• \`/teams\` - View all teams and member counts

*🎫 Creating New Tickets*
1. Click "📝 Create New Ticket" button
2. Enter title (10-100 characters)
3. Enter description (min 50 characters)
4. Select label: Bug, Feature, Improvement, Design, Other
5. Choose priority: Urgent, High, Medium, Low
6. Review and confirm

*📊 Ticket Priorities Explained*
• 🔴 *Urgent* - Blocking work, needs immediate attention
• 🟠 *High* - Important, needed within this week
• 🟡 *Medium* - Standard priority, next sprint
• 🟢 *Low* - Nice to have, when time permits

*💡 Pro Tips*
• Click any ticket in lists to see full details
• Use ticket IDs (FAL-123) in commands
• Templates available for Bug and Feature tickets
• Maximum 5 tickets per user per day
• Sessions timeout after 30 minutes

*🔧 System Commands*
• \`/start\` - Return to main menu
• \`/help\` - Show this guide
• \`/cancel\` - Cancel current operation

*❓ Need Help?*
Contact the tech team in #linear-bot-help channel
    `;

    await this.bot.sendMessage(chatId, helpMessage, { 
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard(),
    });
  }

  async handleCancel(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    try {
      const session = await this.sessionManager.getSession(userId);
      
      if (!session || session.state === SessionState.IDLE) {
        await this.bot.sendMessage(
          chatId,
          'No active operation to cancel.',
          { reply_markup: getMainMenuKeyboard() }
        );
        return;
      }

      // Reset session
      await this.sessionManager.updateSession(userId, {
        state: SessionState.IDLE,
        ticketData: {},
      });

      await this.bot.sendMessage(
        chatId,
        'Operation cancelled. ❌\n\nWhat would you like to do?',
        { reply_markup: getMainMenuKeyboard() }
      );

      await this.db.addAuditLog(userId, 'TICKET_CANCELLED');
    } catch (error) {
      this.logger.error('Error in cancel command:', error);
      await this.bot.sendMessage(
        chatId,
        'Sorry, an error occurred. Please try again.'
      );
    }
  }

  async handleTickets(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }

    try {
      // Send typing indicator to show bot is working
      await this.bot.sendChatAction(chatId, 'typing');

      // Update session state
      await this.sessionManager.updateSession(userId, {
        state: LinearSessionState.VIEWING_ISSUES as any,
        ticketData: { page: 0 },
      });

      // Fetch all issues (for proper pagination)
      const allIssues = await this.linearService.listIssues({ limit: 50 });
      
      // Debug log to see what data we're getting
      this.logger.info('Fetched issues:', {
        count: allIssues.length,
        sample: allIssues.slice(0, 2).map(i => ({
          id: i.identifier,
          status: i.status,
          assignee: i.assignee,
          priority: i.priority.name
        }))
      });
      
      if (allIssues.length === 0) {
        await this.bot.sendMessage(
          chatId,
          '📋 No tickets found.',
          { reply_markup: getMainMenuKeyboard() }
        );
        return;
      }

      // Get first page of issues (5 per page)
      const pageSize = 5;
      const firstPageIssues = allIssues.slice(0, pageSize);
      
      // Format and send issue list for first page
      let message = formatIssueList(firstPageIssues);
      
      // Add page info if there are multiple pages
      if (allIssues.length > pageSize) {
        const totalPages = Math.ceil(allIssues.length / pageSize);
        message += `\n\n_Page 1 of ${totalPages} • Showing 1-${Math.min(pageSize, allIssues.length)} of ${allIssues.length} tickets_`;
      }
      
      const keyboard = getIssueListKeyboard(allIssues, 0, allIssues.length > pageSize);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error in tickets command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, failed to fetch tickets. Please try again.');
    }
  }

  async handleMyTickets(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }

    try {

      // For now, we'll need to map Telegram user to Linear user
      // This would require additional configuration
      await this.bot.sendMessage(
        chatId,
        '🔄 This feature requires Linear user mapping. Please contact administrator.',
        { reply_markup: getMainMenuKeyboard() }
      );
    } catch (error) {
      this.logger.error('Error in mytickets command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, an error occurred. Please try again.');
    }
  }

  async handleTicket(msg: Message, match: RegExpExecArray | null): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    const ticketId = match?.[1];
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }
    
    if (!ticketId) {
      await this.bot.sendMessage(
        chatId,
        '❌ Please provide a ticket ID.\n\nExample: `/ticket FAL-123`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    try {
      // Fetch issue by ID or identifier
      let issue = await this.linearService.getIssue(ticketId);
      
      if (!issue) {
        // Try searching by identifier
        const searchResults = await this.linearService.searchIssues(ticketId, 1);
        if (searchResults.length > 0 && searchResults[0].identifier === ticketId) {
          issue = searchResults[0];
        }
      }

      if (!issue) {
        await this.bot.sendMessage(chatId, `❌ Ticket ${ticketId} not found.`);
        return;
      }

      // Fetch comments
      const comments = await this.linearService.listComments(issue.id);
      
      // Format and send issue details
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
            { text: '🔙 Back to Menu', callback_data: 'main_menu' },
          ],
        ],
      };

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error in ticket command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, failed to fetch ticket details.');
    }
  }

  async handleSearch(msg: Message, match: RegExpExecArray | null): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    const query = match?.[1];
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }

    if (!query) {
      await this.bot.sendMessage(
        chatId,
        '❌ Please provide a search query.\n\nExample: `/search bug in login`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    try {
      // Send typing indicator to show bot is working
      await this.bot.sendChatAction(chatId, 'typing');
      
      // Update session state
      await this.sessionManager.updateSession(userId, {
        state: LinearSessionState.SEARCHING_ISSUES as any,
        ticketData: { searchQuery: query },
      });

      // Search issues
      const issues = await this.linearService.searchIssues(query, 20);
      
      if (issues.length === 0) {
        await this.bot.sendMessage(
          chatId,
          `🔍 No tickets found matching "${query}".`,
          { reply_markup: getMainMenuKeyboard() }
        );
        return;
      }

      // Format and send results
      const message = `🔍 *Search Results for "${query}"*\n\n${formatIssueList(issues)}`;
      const keyboard = getIssueListKeyboard(issues, 0, false);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error in search command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, search failed. Please try again.');
    }
  }

  async handleProjects(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }

    try {
      // Send typing indicator to show bot is working
      await this.bot.sendChatAction(chatId, 'typing');
      
      // Update session state
      await this.sessionManager.updateSession(userId, {
        state: LinearSessionState.VIEWING_PROJECTS as any,
        ticketData: {},
      });

      // Fetch projects
      const projects = await this.linearService.listProjects();
      
      if (projects.length === 0) {
        await this.bot.sendMessage(
          chatId,
          '📁 No projects found.',
          { reply_markup: getMainMenuKeyboard() }
        );
        return;
      }

      // Format and send project list
      const message = formatProjectList(projects);
      const keyboard = getProjectListKeyboard(projects);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error in projects command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, failed to fetch projects.');
    }
  }

  async handleTeams(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }

    try {
      // Update session state
      await this.sessionManager.updateSession(userId, {
        state: LinearSessionState.VIEWING_TEAMS as any,
        ticketData: {},
      });

      // Fetch teams
      const teams = await this.linearService.listTeams();
      
      if (teams.length === 0) {
        await this.bot.sendMessage(
          chatId,
          '👥 No teams found.',
          { reply_markup: getMainMenuKeyboard() }
        );
        return;
      }

      // Format and send team list
      const message = formatTeamList(teams);
      const keyboard = getTeamListKeyboard(teams);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error in teams command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, failed to fetch teams.');
    }
  }

  async handleUrgent(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }

    try {
      // Send typing indicator to show bot is working
      await this.bot.sendChatAction(chatId, 'typing');
      
      // Fetch urgent issues
      const allIssues = await this.linearService.getUrgentIssues();
      
      if (allIssues.length === 0) {
        await this.bot.sendMessage(
          chatId,
          '🚨 No urgent tickets found. Great job! 🎉',
          { reply_markup: getMainMenuKeyboard() }
        );
        return;
      }

      // Get first page of urgent issues
      const pageSize = 5;
      const firstPageIssues = allIssues.slice(0, pageSize);
      
      // Format and send urgent issues
      let message = `🚨 *Urgent Tickets*\n\n${formatIssueList(firstPageIssues)}`;
      
      // Add page info if there are multiple pages
      if (allIssues.length > pageSize) {
        const totalPages = Math.ceil(allIssues.length / pageSize);
        message += `\n\n_Page 1 of ${totalPages} • Showing 1-${Math.min(pageSize, allIssues.length)} of ${allIssues.length} urgent tickets_`;
      }
      
      const keyboard = getIssueListKeyboard(allIssues, 0, allIssues.length > pageSize);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error('Error in urgent command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, failed to fetch urgent tickets.');
    }
  }

  async handleStatus(msg: Message, match: RegExpExecArray | null): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }
    const params = match?.[1]?.split(' ');
    const ticketId = params?.[0];
    const newStatus = params?.slice(1).join(' ');
    
    if (!ticketId || !newStatus) {
      await this.bot.sendMessage(
        chatId,
        '❌ Please provide ticket ID and new status.\n\nExample: `/status FAL-123 In Progress`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    await this.bot.sendMessage(
      chatId,
      '🔄 Status update requires selecting from available statuses. Use `/ticket ' + ticketId + '` and click "Update Status".',
      { parse_mode: 'Markdown' }
    );
  }

  async handleComment(msg: Message, match: RegExpExecArray | null): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    
    if (!userId) {
      await this.bot.sendMessage(chatId, 'Error: Unable to identify user.');
      return;
    }

    if (!(await this.checkAuthentication(userId, chatId))) {
      return;
    }
    const params = match?.[1]?.split(' ');
    const ticketId = params?.[0];
    const comment = params?.slice(1).join(' ');
    
    if (!ticketId || !comment) {
      await this.bot.sendMessage(
        chatId,
        '❌ Please provide ticket ID and comment.\n\nExample: `/comment FAL-123 This is my comment`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    try {
      // Find issue
      let issue = await this.linearService.getIssue(ticketId);
      if (!issue) {
        const searchResults = await this.linearService.searchIssues(ticketId, 1);
        if (searchResults.length > 0 && searchResults[0].identifier === ticketId) {
          issue = searchResults[0];
        }
      }

      if (!issue) {
        await this.bot.sendMessage(chatId, `❌ Ticket ${ticketId} not found.`);
        return;
      }

      // Add comment
      const result = await this.linearService.addComment(issue.id, comment);
      
      if (result) {
        await this.bot.sendMessage(
          chatId,
          `✅ Comment added to ${issue.identifier}: ${issue.title}\n\n💬 "${comment}"`,
          { reply_markup: getMainMenuKeyboard() }
        );
      } else {
        await this.bot.sendMessage(chatId, '❌ Failed to add comment. Please try again.');
      }
    } catch (error) {
      this.logger.error('Error in comment command:', error);
      await this.bot.sendMessage(chatId, 'Sorry, failed to add comment.');
    }
  }
}