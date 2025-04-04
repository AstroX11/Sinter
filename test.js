import { randomUUID } from 'node:crypto';
import Database from './dist/src/index.mjs';

const database = new Database('test.db', {
  open: true,
  enableForeignKeyConstraints: true,
  allowExtension: false,
});

const user = database.define('AstroX11', {
  id: { type: 'STRING', defaultValue: 'AstroX11' },
});

