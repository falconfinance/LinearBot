import TelegramBot, { Message } from 'node-telegram-bot-api';
import { Database } from '../../db/database';
import { SessionManager } from '../sessionManager';
import { LinearService } from '../../api/linearService';
import { logger as Logger } from '../../utils/logger';
import { SessionState, LinearSessionState } from '../../types';
import { validateTitle, validateDescription, sanitizeInput } from '../../utils/validation';
import { getLabelKeyboard, getMainMenuKeyboard } from '../keyboards';

export class MessageHandler {
  constructor(
    private bot: TelegramBot,
    private db: Database,
    private sessionManager: SessionManager,
    // @ts-ignore - linearService will be used in future implementations
    private linearService: LinearService,
    private logger: typeof Logger
  ) {}

  async handleMessage(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id.toString();
    const text = msg.text?.trim();

    if (!userId || !text) {
      return;
    }

    try {
      // Get user session
      const session = await this.sessionManager.getSession(userId);
      
      if (!session) {
        await this.bot.sendMessage(
          chatId,
          'Please start with /start [name_department] to begin.'
        );
        return;
      }

      // Update last activity
      await this.sessionManager.updateSession(userId, { lastActivity: new Date() });

      // Route based on session state
      switch (session.state) {
        case SessionState.AWAITING_TITLE:
          await this.handleTitleInput(msg, userId, text);
          break;
          
        case SessionState.AWAITING_DESCRIPTION:
          await this.handleDescriptionInput(msg, userId, text);
          break;
          
        case SessionState.IDLE:
          await this.bot.sendMessage(
            chatId,
            'Please use the menu buttons to interact with the bot.'
          );
          break;
          
        case LinearSessionState.ADDING_COMMENT:
          await this.handleCommentInput(msg, userId, text);
          break;
          
        case LinearSessionState.UPDATING_STATUS:
        case LinearSessionState.ASSIGNING_ISSUE:
          // These are handled by callback buttons
          await this.bot.sendMessage(
            chatId,
            'Please use the provided buttons to make your selection.'
          );
          break;
          
        default:
          await this.bot.sendMessage(
            chatId,
            'Please use the provided buttons to make your selection.'
          );
      }
    } catch (error) {
      this.logger.error('Error handling message:', error);
      await this.bot.sendMessage(
        chatId,
        'Sorry, an error occurred. Please try again.'
      );
    }
  }

  private async handleTitleInput(msg: Message, userId: string, text: string): Promise<void> {
    const chatId = msg.chat.id;
    const sanitizedTitle = sanitizeInput(text);
    
    // Validate title
    const validation = validateTitle(sanitizedTitle);
    
    if (!validation.isValid) {
      await this.bot.sendMessage(
        chatId,
        `❌ ${validation.error}\n\nPlease provide a valid title:`
      );
      return;
    }

    // Check for duplicate tickets
    const isDuplicate = await this.db.findDuplicateTicket(sanitizedTitle);
    
    if (isDuplicate) {
      await this.bot.sendMessage(
        chatId,
        '⚠️ A ticket with this exact title was created in the last 30 days.\n\n' +
        'Please provide a more specific title or check if your request is already being addressed.'
      );
      return;
    }

    // Save title to session
    await this.sessionManager.updateTicketData(userId, { title: sanitizedTitle });
    await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_DESCRIPTION);

    await this.bot.sendMessage(
      chatId,
      '✅ Title saved!\n\n' +
      'Now, please provide a description of your request:\n\n' +
      '*Minimum 10 characters required.*',
      { parse_mode: 'Markdown' }
    );
  }

  private async handleDescriptionInput(msg: Message, userId: string, text: string): Promise<void> {
    const chatId = msg.chat.id;
    const session = await this.sessionManager.getSession(userId);
    
    if (!session) {
      return;
    }

    // Check if this is a template response
    if (session.ticketData.awaitingTemplate) {
      // User is providing description based on template
      await this.sessionManager.updateTicketData(userId, { 
        description: text,
        awaitingTemplate: false 
      });
    } else {
      const sanitizedDescription = sanitizeInput(text);
      
      // Validate description
      const validation = validateDescription(sanitizedDescription);
      
      if (!validation.isValid) {
        await this.bot.sendMessage(
          chatId,
          `❌ ${validation.error}\n\nPlease provide more detail:`
        );
        return;
      }

      await this.sessionManager.updateTicketData(userId, { description: sanitizedDescription });
    }

    // Check if we already have a label (from category selection)
    if (session.ticketData.label) {
      // Skip to confirmation since we already have category/label
      await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_CONFIRMATION);
      
      // Auto-set priority to Medium for streamlined flow
      const { TicketPriority } = await import('../../types');
      await this.sessionManager.updateTicketData(userId, { priority: TicketPriority.MEDIUM });
      
      const { formatTicketSummary } = await import('../templates');
      const { getConfirmationKeyboard } = await import('../keyboards');
      
      const summary = formatTicketSummary(session.ticketData);
      
      await this.bot.sendMessage(
        chatId,
        '✅ Description saved!\n\n' + summary,
        { 
          reply_markup: getConfirmationKeyboard(),
          parse_mode: 'Markdown'
        }
      );
    } else {
      // Old flow - move to label selection
      await this.sessionManager.updateSessionState(userId, SessionState.AWAITING_LABEL);

      await this.bot.sendMessage(
        chatId,
        '✅ Description saved!\n\n' +
        'Now, please select the appropriate label for your request:',
        { reply_markup: getLabelKeyboard() }
      );
    }
  }

  // Password authentication removed - no longer needed
  /*
  private async handlePasswordInput(msg: Message, userId: string, password: string): Promise<void> {
    const chatId = msg.chat.id;
    
    try {
      // Import config to get the password
      const { config } = await import('../../config');
      
      // Check if password is correct
      if (password === config.auth.password) {
        // Update user as authenticated
        await this.db.updateUserAuthentication(userId, true);
        
        // Update session to idle state
        await this.sessionManager.updateSession(userId, {
          state: SessionState.IDLE,
          ticketData: {},
        });
        
        // Get user info for personalized message
        const user = await this.db.getUserById(userId);
        const fullName = user?.full_name || 'User';
        
        await this.bot.sendMessage(
          chatId,
          `✅ Authentication successful!\n\n` +
          `Welcome ${fullName}! You now have full access to the Falcon Linear Bot.\n\n` +
          `🚀 *Available Commands:*\n\n` +
          `📋 *Ticket Management*\n` +
          `• \`/tickets\` - View recent tickets grouped by priority\n` +
          `• \`/mytickets\` - View tickets assigned to you\n` +
          `• \`/ticket FAL-123\` - View specific ticket details\n` +
          `• \`/urgent\` - Quick view of all urgent tickets\n` +
          `• \`/search query\` - Search tickets by title/description\n` +
          `• \`/comment FAL-123 text\` - Add a comment to a ticket\n\n` +
          `📁 *Organization*\n` +
          `• \`/projects\` - List all projects with progress\n` +
          `• \`/teams\` - List all teams and members\n\n` +
          `🔧 *Bot Commands*\n` +
          `• \`/start\` - Start the bot or return to main menu\n` +
          `• \`/help\` - Show detailed help and guidelines\n` +
          `• \`/cancel\` - Cancel current operation\n\n` +
          `💡 *Quick Tips:*\n` +
          `• Use the buttons below to create new tickets\n` +
          `• Click on any ticket in lists to view details\n` +
          `• All commands work with ticket IDs (e.g., FAL-123)\n\n` +
          'What would you like to do?',
          {
            parse_mode: 'Markdown',
            reply_markup: getMainMenuKeyboard(),
          }
        );
        
        await this.db.addAuditLog(userId, 'USER_AUTHENTICATED');
      } else {
        // Wrong password
        await this.bot.sendMessage(
          chatId,
          '❌ Incorrect password. Please try again.\n\n' +
          '🔒 Enter the password to access the bot:',
          {
            reply_markup: {
              remove_keyboard: true,
            },
          }
        );
        
        this.logger.warn(`Failed authentication attempt for user ${userId}`);
      }
    } catch (error) {
      this.logger.error('Error handling password input:', error);
      await this.bot.sendMessage(
        chatId,
        'Sorry, an error occurred. Please try again with /start.'
      );
    }
  }
  */

  private async handleCommentInput(msg: Message, userId: string, comment: string): Promise<void> {
    const chatId = msg.chat.id;
    
    try {
      const session = await this.sessionManager.getSession(userId);
      
      if (!session || !session.ticketData.issueId) {
        await this.bot.sendMessage(chatId, 'Session expired. Please try again.');
        return;
      }

      // Add comment to the issue
      const result = await this.linearService.addComment(session.ticketData.issueId, comment);
      
      if (result) {
        await this.bot.sendMessage(
          chatId,
          '✅ Comment added successfully!',
          { reply_markup: getMainMenuKeyboard() }
        );
      } else {
        await this.bot.sendMessage(
          chatId,
          '❌ Failed to add comment. Please try again.',
          { reply_markup: getMainMenuKeyboard() }
        );
      }
      
      // Clear session
      await this.sessionManager.updateSession(userId, {
        state: SessionState.IDLE,
        ticketData: {},
      });
    } catch (error) {
      this.logger.error('Error handling comment input:', error);
      await this.bot.sendMessage(
        chatId,
        'Sorry, an error occurred. Please try again.',
        { reply_markup: getMainMenuKeyboard() }
      );
    }
  }
}