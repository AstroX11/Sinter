import Database from './dist/src/index.mjs';
import crypto from 'node:crypto'

const db = new Database('test.db', { enableForeignKeyConstraints: true });

const users = db.define(
  'User',
  {
    username: { type: 'string', unique: true, allowNull: false, primaryKey: true },
    email: { type: 'string', unique: true, allowNull: false, validate: { isEmail: true } },
    password: { type: 'string', allowNull: false },
  },
  { freezeTableName: true, tableName: 'astro' },
);



console.log(await users.truncate())