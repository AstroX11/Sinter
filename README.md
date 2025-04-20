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
import Database, { DataType } from '@astrox11/sqlite'

const db = new Database(':memory:', {/** other options **/ })

const Users = db.define('usersTable', {
  name: { type: DataType.STRING, primaryKey: true },
  password: { type: DataType.INTEGER, allowNull: false }
})

const result = await Users.create({ name: 'AstroX11', password: '123' })

console.log(result)
```

***Result***
```bash
[Object: null prototype] {
  name: 'AstroX11',
  password: 123,
  createdAt: 1745169206608,
  updatedAt: 1745169206608
}
```

**Using findAll function**
```javascript
import Database, { DataType } from '@astrox11/sqlite';

const db = new Database(':memory:');

// Define schema
const userSchema = {
  id: { type: DataType.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataType.STRING },
  role: { type: DataType.STRING },
  meta: { type: DataType.JSON },
};

const postSchema = {
  id: { type: DataType.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataType.STRING },
  content: { type: DataType.TEXT },
  userId: { type: DataType.INTEGER, references: { model: 'users', key: 'id' } },
};

// Setup models
const User = db.define('users', userSchema, {
  timestamps: true,
  paranoid: true,
});

const Post = db.define('posts', postSchema, {
  timestamps: true,
  paranoid: false,
});

// Patch: Add .name property to enable join resolution
Object.defineProperty(User, 'name', { value: 'users' });
Object.defineProperty(Post, 'name', { value: 'posts' });

// Seed data
await User.create({ name: 'Alice', role: 'admin', meta: JSON.stringify({ age: 30 }) });
await User.create({ name: 'Bob', role: 'user', meta: JSON.stringify({ age: 25 }) });

await Post.create({ title: 'First Post', content: 'Hello world!', userId: 1 });
await Post.create({ title: 'Another Post', content: 'Testing', userId: 1 });
await Post.create({ title: "Bob's Post", content: 'Bob here!', userId: 2 });

// Wait a moment for createdAt values to differ
await new Promise(resolve => setTimeout(resolve, 100));

// ✅ Basic query with filters
console.log('\n[Basic WHERE]');
console.log(await User.findAll({
  where: { role: 'admin' },
}));

// ✅ JSON filter
console.log('\n[JSON WHERE]');
console.log(await User.findAll({
  where: {
    meta: { json: ['age', 30] }
  }
}));

// ✅ OR / AND logic
console.log('\n[OR & AND]');
console.log(await User.findAll({
  where: {
    or: [
      { name: 'Alice' },
      { role: 'user' }
    ],
    and: [
      { meta: { json: ['age', 25] } }
    ]
  }
}));

// ✅ Include with JOIN
console.log('\n[JOIN]');
console.log(await Post.findAll({
  include: [
    {
      model: User,
      as: 'user',
      required: true
    }
  ]
}));

// ✅ Custom attributes
console.log('\n[ATTRIBUTES]');
console.log(await User.findAll({
  attributes: ['name']
}));

// ✅ ORDER, LIMIT, OFFSET
console.log('\n[ORDER + PAGINATION]');
console.log(await Post.findAll({
  order: [['createdAt', 'DESC']],
  limit: 2,
  offset: 1
}));

// ✅ GROUP BY (if implemented)
console.log('\n[GROUP BY]');
console.log(await Post.findAll({
  groupBy: ['userId']
}));
```

***Result***
```bash
[Basic WHERE]
[
  [Object: null prototype] {
    id: 1,
    name: 'Alice',
    role: 'admin',
    meta: '{"age":30}',
    createdAt: 1745169626979,
    updatedAt: 1745169626979,
    deletedAt: null
  }
]

[JSON WHERE]
[
  [Object: null prototype] {
    id: 1,
    name: 'Alice',
    role: 'admin',
    meta: '{"age":30}',
    createdAt: 1745169626979,
    updatedAt: 1745169626979,
    deletedAt: null
  }
]

[OR & AND]
[
  [Object: null prototype] {
    id: 2,
    name: 'Bob',
    role: 'user',
    meta: '{"age":25}',
    createdAt: 1745169626979,
    updatedAt: 1745169626979,
    deletedAt: null
  }
]

[JOIN]
[
  [Object: null prototype] {
    id: 1,
    title: 'First Post',
    content: 'Hello world!',
    userId: 1,
    createdAt: 1745169626979,
    updatedAt: 1745169626979
  },
  [Object: null prototype] {
    id: 2,
    title: 'Another Post',
    content: 'Testing',
    userId: 1,
    createdAt: 1745169626979,
    updatedAt: 1745169626979
  }
]

[ATTRIBUTES]
[
  [Object: null prototype] { name: 'Alice' },
  [Object: null prototype] { name: 'Bob' }
]

[ORDER + PAGINATION]
[
  [Object: null prototype] {
    id: 2,
    title: 'Another Post',
    content: 'Testing',
    userId: 1,
    createdAt: 1745169626979,
    updatedAt: 1745169626979
  },
  [Object: null prototype] {
    id: 3,
    title: "Bob's Post",
    content: 'Bob here!',
    userId: 2,
    createdAt: 1745169626979,
    updatedAt: 1745169626979
  }
]

[GROUP BY]
[
  [Object: null prototype] {
    id: 1,
    title: 'First Post',
    content: 'Hello world!',
    userId: 1,
    createdAt: 1745169626979,
    updatedAt: 1745169626979
  },
  [Object: null prototype] {
    id: 3,
    title: "Bob's Post",
    content: 'Bob here!',
    userId: 2,
    createdAt: 1745169626979,
    updatedAt: 1745169626979
  }
]
```


**Using findByPk function**

```javascript
import Database, { DataType } from '@astrox11/sqlite';

const db = new Database(':memory:');

const user = db.define('users', {
  id: { type: DataType.INTEGER, primaryKey: true, defaultValue: 1 },
  name: { type: DataType.STRING }
})


user.create({ id: 20, name: 'AstroX11' })

console.log(await user.findByPk(20))
```

***Result***
```bash
[Object: null prototype] {
  id: 20,
  name: 'AstroX11',
  createdAt: 1745169472265,
  updatedAt: 1745169472265
}
```

### Contributing

Your contributions help keep this project alive and growing. We appreciate any form of contribution, from bug reports to feature improvements.

Feel free to check our issues page or submit your ideas. Thanks for making this project better!
