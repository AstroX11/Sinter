import Database, { DATATYPE } from './dist/src/index.mjs';
import crypto from 'node:crypto';

const db = new Database('test.db', { enableForeignKeyConstraints: true });

const Antilink = db.define(
  'Antilink',
  {
    jid: { type: DATATYPE.STRING, allowNull: false },
    status: { type: DATATYPE.BOOLEAN, allowNull: true, defaultValue: 0 },
  },
  { freezeTableName: true, timestamps: false },
);

// Now this will work correctly with multiple parameters
const result = Antilink.findAndCountAll({
  where: {
    jid: '123@whatsapp.net',
    status: true,
  },
});

console.log(result);
