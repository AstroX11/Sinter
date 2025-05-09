import { Database, DataType } from '@astrox11/sqlite';

const db = new Database(':memory:');

const test = db.define('test', {
 from: {
  type: DataType.STRING,
  unique: true,
 },
});
console.log(await test.bulkCreate([{ from: '223' }, { from: '223' }]));
