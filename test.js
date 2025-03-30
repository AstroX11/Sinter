import Database, { DATATYPE } from './dist/src/index.mjs';

const db = new Database('test.db', { enableForeignKeyConstraints: true });

const Antilink = db.define(
  'Antilink',
  {
    jid: { type: DATATYPE.STRING, allowNull: false },
    status: { type: DATATYPE.BOOLEAN, allowNull: true, defaultValue: 0 },
  },
  { freezeTableName: true, timestamps: false },
);

const result = Antilink.findByPk(1)