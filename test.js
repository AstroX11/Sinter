import { Database } from './dist/src/index.mjs';

const db = new Database('test.db', { enableForeignKeyConstraints: true });

db.define('User', {
  id: {
    type: 'INTEGER',
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: 'STRING',
    allowNull: false,
    unique: true
  },
  email: {
    type: 'STRING',
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  age: {
    type: 'INTEGER',
    defaultValue: 18
  },
  isAdmin: {
    type: 'BOOLEAN',
    defaultValue: false
  },
  metadata: {
    type: 'JSON',
    defaultValue: {}
  }
}, {
  tableName: 'app_users',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    {
      fields: ['email'],
      unique: true
    },
    {
      fields: ['age'],
      where: 'is_admin = 1'
    }
  ]
});