## `Sqlite Native`

A lightweight ORM for SQLite using Node.js's native `node:sqlite` module. Provides typed database operations with simple query building and schema definitions, inspired by Sequelize but optimized for SQLite performance.

### `Getting Started`

> [!Important]
> This library requires [Node.js v23](https://nodejs.org/en/blog/release/v23.10.0) or later. Older versions (including Node.js 20 LTS) are not supported due to dependencies on the experimental `node:sqlite` module.

#### Installation

```bash
npm install @astrox/sqlite
```

```bash
yarn add @astrox11/sqlite
```

### Get Started

**Basic Setup**

```javascript
import Database, {DataType} from '@astrox11/sqlite'

const db = new Database(':memory:', {/** other options **/})

const Users = db.define('usersTable', {
    name: {type: DataType.STRING, primaryKey: true},
    password: {type: DataType.INTEGER, allowNull: false}
})

const result = await Users.create({name: 'AstroX11', password: '123'})

console.log(result)

```

### Contributing

Your contributions help keep this project alive and growing. We appreciate any form of contribution, from bug reports to feature improvements.

Feel free to check our issues page or submit your ideas. Thanks for making this project better!
