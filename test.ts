import { Database, DataType } from '@astrox11/sqlite';

const db = new Database(':memory:');

const test = db.define('test', {
 alive: { type: DataType.JSON, allowNull: true },
});
console.log(await test.create({ alive: { id: '1234' } }));
