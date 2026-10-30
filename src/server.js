require('dotenv').config();
const app = require('./app');
const connectDatabase = require('./config/db');
const port = Number(process.env.PORT) || 3000;

connectDatabase().then(() => {
  app.listen(port, () => console.log(`Transaction Ledger API listening on port ${port}`));
}).catch(error => {
  console.error('Unable to start application:', error.message);
  process.exit(1);
});
