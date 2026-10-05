// PM2 Production Process Configuration
// PC Bastos Harvest Management System 2026

module.exports = {
  apps: [
    {
      name: 'pc-bastos-harvest-system',
      script: './src/backend/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DB_PATH: './data/harvest.sqlite'
      }
    }
  ]
};
