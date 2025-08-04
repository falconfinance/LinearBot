module.exports = {
  apps: [{
    name: 'linear-bot',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Restart strategies
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    
    // Monitoring
    instance_var: 'INSTANCE_ID'
  }, {
    name: 'linear-bot-daily-reset',
    script: './dist/utils/dailyReset.js',
    instances: 1,
    exec_mode: 'fork',
    cron_restart: '0 0 * * *', // Run at midnight every day
    autorestart: false,
    watch: false,
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/pm2-cron-error.log',
    out_file: './logs/pm2-cron-out.log',
    log_file: './logs/pm2-cron-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};