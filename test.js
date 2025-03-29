import Database from './dist/src/index.mjs';

const db = new Database('test.db', { enableForeignKeyConstraints: true });

const users = db.define(
  'User',
  {
    username: { type: 'string', unique: true, allowNull: false },
    email: { type: 'string', unique: true, allowNull: false, validate: { isEmail: true } },
    password: { type: 'string', allowNull: false },
  },
  { freezeTableName: true, tableName: 'astro' },
);