const app = require('./app');
const { runMigrations } = require('./migrations/migrate');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await runMigrations();
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`  PC BASTOS HARVEST MANAGEMENT SYSTEM - ONLINE`);
      console.log(`  Server listening on http://localhost:${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Fatal error during startup:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
