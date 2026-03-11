module.exports = {
  apps: [{
    name: 'whatsapp-reminder-system',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    interpreter: 'node',
    interpreter_args: '',
    min_uptime: '10s',
    max_restarts: 3,
    restart_delay: 5000,
    exec_mode: 'fork',
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 30000,
    shutdown_with_message: true,
    source_map_support: true,
    instance_var: 'INSTANCE_ID',
    merge_logs: true,
    output: './logs/output.log',
    error: './logs/error.log',
    log: './logs/system.log',
    pid_file: './tmp/pids/pm2-1.pid',
    cron_restart: null,
    max_restarts: 10,
    restart_delay: 4000,
    min_uptime: '0
10s',
    max_memory_restart: '350M',
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug'
    },
    env_test: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error'
    },
    env_production: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    }
  }]
};