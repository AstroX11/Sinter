import Database, { DataType } from './dist/src/index.js';

const db = new Database(':memory:');

db.define('message', {
  id: { type: DataType.STRING, allowNull: true },
  message: { type: DataType.JSON, allowNull: true, }
}).create({ id: '1234455', message: JSON.stringify({ car: 'bmw' }) })