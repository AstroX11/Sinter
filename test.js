import { Database } from './dist/src/index.mjs';

const db = new Database('test.db', {});

db.define('User', {
    email: {
      type: 'STRING',
      allowNull: false,
      validate: {
        isEmail: { msg: 'Must be a valid email address' },
      },
      defaultValue: 'm@d.g.com' // This will trigger validation error
    }
  });
