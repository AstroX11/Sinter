import Database, { DataType } from './dist/src/index.js';

const db = new Database(':memory:');

const user = db.define('users', {
  id: { type: DataType.INTEGER, primaryKey: true, defaultValue: 1 },
  name: { type: DataType.STRING }
})


user.create({ id: 20, name: 'AstroX11' })

console.log(await user.findByPk(20))