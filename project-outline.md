# Telegram-Linear Bot Implementation Plan

## 📋 Project Overview

### Problem Statement
The Product Tech team is overwhelmed with feature requests, ad-hoc requests, and bug reports. QA team members (Regina and Vika) spend significant time manually creating Linear tickets, creating a bottleneck in the process.

### Solution
A Telegram bot that allows requestors to create Linear tickets directly, with proper validation and structure, automatically assigned to Regina for triaging.

## 🎯 Core Requirements

### Required Information for Each Ticket
1. **Title**: Clear, concise description (10-100 characters)
2. **Description**: Detailed context (minimum 50 characters)
3. **Label**: Bug, Improvement, Design, Feature, or Other
4. **Priority**: Urgent, High, Medium, or Low
5. **Auto-assignments**:
   - Assignee: Regina (default)
   - Project: "Request Tickets" (default)

## 🏗️ Technical Architecture

### Technology Stack
- **Backend**: Node.js or Python
- **Bot Framework**: Telegram Bot API (using long polling)
- **Integration**: Linear API
- **Database**: SQLite (audit logs, file-based)
- **Cache**: In-memory cache or file-based storage
- **Deployment**: Local machine (development phase)
- **Process Manager**: PM2 (for auto-restart)

### API Requirements

#### Linear API
- **Permissions needed**:
  - Create issues
  - Read projects
  - Read team members
- **Endpoints**:
  - `POST /issues` - Create new ticket
  - `GET /projects` - Verify project exists
  - `GET /users` - Get Regina's user ID

#### Telegram Bot API
- Long polling implementation (suitable for local deployment)
- No webhook/HTTPS requirements
- Inline keyboards for better UX
- Auto-reconnect on connection loss

## 💬 Conversation Flow

### Main Flow Diagram
```
START
  ↓
User Authentication (/start [name_department])
  ↓
Main Menu
  ├─ Create New Ticket
  ├─ Check Ticket Status (future)
  └─ Help/Guidelines
  ↓
Ticket Creation Wizard
  ├─ 1. Title Input
  ├─ 2. Description Input
  ├─ 3. Label Selection
  ├─ 4. Priority Selection
  └─ 5. Review & Confirm
  ↓
Linear Ticket Created
  ↓
Confirmation with Ticket Link
```

### Detailed Interaction Scripts

#### Step 1: Welcome & Authentication
```
Bot: "Welcome to Falcon Linear Ticket Bot! 
Please identify yourself: /start [your_name_department]"

User: "/start Richard_BD"

Bot: "Hi Richard from BD! How can I help you today?"
[Create Ticket] [View Guidelines] [Contact Support]
```

#### Step 2: Title Collection
```
Bot: "Let's create a ticket. First, provide a clear, concise title (10-100 characters):
Example: 'Add aToken as collateral option'"

User: "Add aToken to accepted collateral list"

Bot: "✓ Title saved. Now, let's add context..."
```

#### Step 3: Description Collection
```
Bot: "Please provide detailed context. Consider including:
- What feature/issue are you reporting?
- Why is this needed?
- Who will benefit?
- Any deadlines or dependencies?

Minimum 50 characters required."

User: [provides detailed context]

Bot: "✓ Description saved. Let's categorize your request..."
```

#### Step 4: Label Selection
```
Bot: "Select the appropriate label:"
[🐛 Bug] [✨ Improvement] [🎨 Design] 
[🚀 Feature] [📋 Other]

User: [Selects Improvement]
```

#### Step 5: Priority Selection
```
Bot: "How urgent is this request?"
[🔴 Urgent - Blocking work]
[🟠 High - Needed this week]
[🟡 Medium - Next sprint]
[🟢 Low - Nice to have]

User: [Selects High]
```

#### Step 6: Review & Confirmation
```
Bot: "Please review your ticket:
📋 Title: Add aToken to accepted collateral list
🏷️ Label: Improvement
🎯 Priority: High
📝 Description: [shows description]
👤 Will be assigned to: Regina

[✅ Create Ticket] [✏️ Edit] [❌ Cancel]"
```

## 🛡️ Validation Rules

### Input Validation
- **Title**: 
  - Length: 10-100 characters
  - No special characters except: - _ . , !
  - Cannot be duplicate of existing ticket (last 30 days)
  
- **Description**:
  - Minimum 50 characters
  - Must contain at least one "what" and one "why" statement
  - Auto-detect vague descriptions and request more detail

### User Management
- Whitelist of approved users (stored in database)
- Rate limiting: Maximum 5 tickets per user per day
- User identification format: `[Name]_[Department]`

## 📝 Data Models

### Ticket Request Schema
```javascript
{
  id: UUID,
  telegram_user_id: String,
  telegram_username: String,
  department: String,
  title: String,
  description: String,
  label: Enum['Bug', 'Improvement', 'Design', 'Feature', 'Other'],
  priority: Enum['Urgent', 'High', 'Medium', 'Low'],
  status: Enum['draft', 'submitted', 'created', 'failed'],
  linear_ticket_id: String,
  linear_ticket_url: String,
  created_at: Timestamp,
  submitted_at: Timestamp,
  session_data: JSON
}
```

### User Schema
```javascript
{
  id: UUID,
  telegram_user_id: String,
  telegram_username: String,
  full_name: String,
  department: String,
  email: String,
  is_active: Boolean,
  created_at: Timestamp,
  last_active: Timestamp,
  tickets_created_today: Integer,
  total_tickets_created: Integer
}
```

## 🎨 Templates

### Bug Report Template
```
**Steps to Reproduce:**
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
```

### Feature Request Template
```
**User Story:**
As a [type of user], I want [feature] so that [benefit].

**Business Value:**
[Why this matters to the business]

**Success Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Dependencies:**
[Any blockers or requirements]
```

## 🚀 Implementation Phases

### Phase 1: MVP (Week 1-2)
- [ ] Basic Telegram bot setup
- [ ] Linear API integration
- [ ] Core ticket creation flow
- [ ] Simple validation
- [ ] Manual user whitelist
- [ ] Basic error handling

### Phase 2: Enhanced UX (Week 3-4)
- [ ] Template system
- [ ] Advanced error handling
- [ ] Edit functionality during creation
- [ ] Ticket status checking
- [ ] Help command with examples
- [ ] Session persistence

### Phase 3: Analytics & Optimization (Week 5-6)
- [ ] Usage analytics dashboard
- [ ] Response time tracking
- [ ] Common request pattern analysis
- [ ] Auto-suggestions based on history
- [ ] Weekly summary reports
- [ ] Quality score system

## 📊 Success Metrics

### KPIs to Track
1. **Efficiency Metrics**
   - Average ticket creation time: Target < 2 minutes
   - QA time saved: Target 2+ hours/week
   - First-time success rate: Target > 90%

2. **Quality Metrics**
   - Ticket quality score: Target > 80% have sufficient context
   - Percentage of tickets needing clarification: Target < 20%
   
3. **Adoption Metrics**
   - User adoption rate: Target 70% in 30 days
   - Daily active users
   - Tickets created via bot vs manual

## 🔒 Security & Compliance

### Security Measures
1. **Authentication**
   - Telegram user ID validation
   - Department-based access control
   
2. **Data Protection**
   - All API keys in environment variables (never in code)
   - SQLite database file permissions (chmod 600)
   - No external access to local machine
   
3. **Audit Trail**
   - Log all ticket creations
   - Track user actions
   - Retention policy: 90 days
   - Regular backup of SQLite database

### Local Deployment Security
- Keep bot token and Linear API key secure
- Restrict database file access
- Regular security updates for dependencies
- Use .gitignore for sensitive files
- Consider encrypting SQLite database

## 🚨 Error Handling

### Common Errors & Solutions

| Error | User Message | Technical Solution |
|-------|--------------|-------------------|
| Linear API Down | "Oops! Can't reach Linear right now. Your ticket is saved and will be created automatically." | Queue system with retries |
| Invalid Input | "Please check your input. [Specific guidance]" | Clear validation messages |
| Rate Limit | "You've created 5 tickets today. Please try again tomorrow or contact Regina directly." | SQLite counter with date check |
| Session Timeout | "Your session expired. Let's start over: /start" | 30-minute session timeout |
| Bot Offline | N/A - Users won't receive response | PM2 auto-restart, monitoring alerts |
| Network Issues | "Connection error. Please try again in a moment." | Exponential backoff, auto-reconnect |
| Database Locked | "System busy. Please try again." | SQLite busy timeout, query queue |

## 📚 API Integration Examples

### Create Linear Ticket
```javascript
async function createLinearTicket(ticketData) {
  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const variables = {
    input: {
      title: ticketData.title,
      description: ticketData.description,
      teamId: TEAM_ID,
      projectId: REQUEST_TICKETS_PROJECT_ID,
      assigneeId: REGINA_USER_ID,
      priority: mapPriorityToLinear(ticketData.priority),
      labelIds: [getLabelId(ticketData.label)]
    }
  };

  // Execute mutation...
}
```

### Telegram Bot Message Handler
```javascript
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Check user session
  const session = await getSession(userId);
  
  if (!session) {
    // Start new session
    await bot.sendMessage(chatId, 'Welcome! Please start with /start [name_department]');
    return;
  }
  
  // Route to appropriate handler based on session state
  switch(session.state) {
    case 'AWAITING_TITLE':
      await handleTitleInput(msg, session);
      break;
    case 'AWAITING_DESCRIPTION':
      await handleDescriptionInput(msg, session);
      break;
    // ... other states
  }
});
```

## 💻 Local Deployment Setup

### Running Locally with Long Polling

#### Bot Initialization (Node.js Example)
```javascript
const TelegramBot = require('node-telegram-bot-api');

// Use long polling instead of webhooks for local deployment
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

// Handle polling errors
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});
```

#### Local Environment Setup
1. **Environment Variables** (.env file)
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
LINEAR_API_KEY=your_linear_api_key_here
DATABASE_PATH=./data/bot.db
SESSION_TIMEOUT_MINUTES=30
```

2. **Database Setup** (SQLite)
```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/bot.db');

// Initialize tables
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  telegram_user_id TEXT UNIQUE,
  telegram_username TEXT,
  full_name TEXT,
  department TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
```

3. **Process Management** (PM2)
```bash
# Install PM2
npm install -g pm2

# Start the bot
pm2 start bot.js --name "linear-bot" --watch

# Auto-restart on system reboot
pm2 startup
pm2 save

# View logs
pm2 logs linear-bot

# Monitor
pm2 monit
```

### Local Development Advantages
- No hosting costs during development
- Full control over environment
- Easy debugging and testing
- Quick iteration cycles
- No deployment pipeline needed initially

### Local Deployment Considerations
1. **Availability**: Bot only works when your machine is running
2. **Network**: Requires stable internet connection
3. **Resources**: Minimal (< 100MB RAM, minimal CPU)
4. **Backup**: Regular SQLite database backups recommended
5. **Monitoring**: Set up basic health checks

### Migration Path to Cloud
When ready for production:
1. Test thoroughly on local machine
2. Document all environment variables
3. Export SQLite database
4. Choose cloud provider (DigitalOcean, Vultr, etc.)
5. Update code for webhook support
6. Migrate database to PostgreSQL
7. Set up proper monitoring

## 🎯 Future Enhancements

### Version 2.0 Ideas
1. **Slack Integration** - Mirror functionality in Slack
2. **Ticket Templates** - Save and reuse common requests
3. **Bulk Operations** - Create multiple related tickets
4. **Smart Assignments** - Auto-assign based on ticket type
5. **NLP Enhancement** - Better understanding of natural language
6. **Ticket Dependencies** - Link related tickets
7. **Attachment Support** - Screenshots and documents
8. **Multi-language Support** - For global teams

## 📞 Support & Maintenance

### Documentation Needed
1. User Guide (2-page PDF)
2. Video Tutorial (2-3 minutes)
3. FAQ Document
4. Admin Guide for Regina
5. Developer Documentation

### Support Channels
- Dedicated Slack channel: #linear-bot-help
- Bot command: /help
- Escalation: Direct message to tech team

## ✅ Pre-Launch Checklist

### Local Deployment Checklist
- [ ] Linear API credentials obtained and tested
- [ ] Telegram bot created and token saved
- [ ] Bot set to long polling mode
- [ ] Local SQLite database initialized
- [ ] User whitelist populated
- [ ] Regina's Linear user ID confirmed
- [ ] "Request Tickets" project ID confirmed
- [ ] Label IDs mapped correctly
- [ ] PM2 installed and configured
- [ ] Environment variables set up
- [ ] Local backup strategy defined
- [ ] Test data cleared from database
- [ ] Error logging configured
- [ ] User training materials ready
- [ ] Team notified of bot's operating hours

### Production Migration Checklist (Future)
- [ ] Cloud provider selected
- [ ] Domain/Static IP acquired
- [ ] HTTPS certificate ready
- [ ] Database migration plan
- [ ] Monitoring solution chosen
- [ ] Backup automation configured

## 🤝 Stakeholder Sign-offs Needed

1. **Regina** - Workflow and assignment logic
2. **Tech Lead** - Technical architecture
3. **Security** - Data handling and storage
4. **BD/Marketing Leads** - User experience flow
5. **DevOps** - Deployment and monitoring

---

**Note**: This document should be treated as a living document and updated as requirements evolve during development.