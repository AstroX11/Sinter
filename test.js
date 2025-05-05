import { Database, DataType } from '@astrox11/sqlite';

const db = new Database('test.db');

const user = db.define('users', {
 id: { type: DataType.INTEGER, autoIncrement: true, primaryKey: true },
 name: { type: DataType.STRING, allowNull: true },
 age: { type: DataType.INTEGER, allowNull: false },
});

// console.log(await user.upsert({ id: 1, name: 'AstroX11', age: 16 }));

console.log(await user.update({ age: 20 }, { where: { age: 40 } }));
