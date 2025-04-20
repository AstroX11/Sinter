import Database, { DataType } from '@astrox11/sqlite'

const db = new Database(':memory:', {/** other options **/ })

const Users = db.define('usersTable', {
  name: { type: DataType.STRING, primaryKey: true },
  password: { type: DataType.INTEGER, allowNull: false }
})

const result = await Users.create({ name: 'AstroX11', password: '123' })

console.log(result)
