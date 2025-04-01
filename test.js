import Database from './dist/src/index.mjs';

const db = new Database('test.db', {});

const Users = db.define(
  'Users',
  {
    id: { type: 'STRING', allowNull: false, primaryKey: true },
    username: { type: 'STRING', allowNull: false, unique: true },
  },
  { freezeTableName: true },
);

console.log(Users.findOne({t}));
