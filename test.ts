import { Database, DataType } from '@astrox11/sqlite';

const db = new Database(':memory:');

const user = db.define('user', {
 active: { type: DataType.BOOLEAN, allowNull: true },
});

const activity: boolean | undefined = undefined;

console.log(await user.create({ active: activity }));
