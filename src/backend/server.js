const app = require('./app');
const { ensureSeeded } = require('./seed');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

async function startServer() {
  try {
    // Auto-migrate and ensure initial seed data exists on fresh deployments
    await ensureSeeded();

    const server = app.listen(PORT, HOST, () => {
      console.log(`====================================================`);
      console.log(`  PC BASTOS HARVEST MANAGEMENT SYSTEM - ONLINE`);
      console.log(`  Server listening on http://${HOST}:${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`====================================================`);
    });

    // Graceful shutdown handling for Cloud Platforms (Render, Docker, Kubernetes)
    const gracefulShutdown = (signal) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (err) {
    console.error('Fatal error during startup:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
