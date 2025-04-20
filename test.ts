import Database, { DataType } from './dist/src/index.js';

const db = new Database(':memory:');

const User = db.define('user', {
  name: { type: DataType.STRING },
  email: { type: DataType.STRING, allowNull: true }
})

console.log(await User.create({ name: 'AstroX11', email: null }))