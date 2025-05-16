# `Qunatava`

## About

Qunatava is an open-source ORM that abstracts all the complications that come with using raw SQLite queries. It introduces advanced features that make database management simple and efficient.

## Features

- **Automatic Table Generation** – Models define your schema; tables are created seamlessly without manual sync
- **Robust Query Interface** – Expressive and fluent API for data retrieval, mutation, and aggregation
- **Model Associations** – Native support for foreign keys and relational mapping between tables
- **Type-Safe** – Built-in typing support ensures consistency and developer confidence
- **Intelligent Type Handling** – Automatic conversion and management of diverse JavaScript data types, including `undefined`
- **Built-In Error Handling** – Structured and automatic error management at every operation level
- **Fully Asynchronous** – Modern, promise-based design for seamless integration with async workflows

## Setup

```bash
npm i quantava
```

```bash
yarn add qunatava
```

```bash
pnpm install qunatava
```

```javascript
import { Database, DataType, JournalMode } from 'quantava';

const database = new Database(':memory:', {
 journalMode: JournalMode.OFF,
 busyTimeout: 7000,
 allowExtension: true,
 /** Other Options */
});

const User = database.define(
 'user',
 {
  id: {
   type: DataType.INTEGER,
   allowNull: false,
   autoIncrement: true,
   primaryKey: true,
  },
  name: { type: DataType.STRING, allowNull: false },
  password: {
   type: DataType.STRING,
   allowNull: false,
   validate: {
    isPassword: () => {
     return true;
    },
   },
  },
 },
 { timestamps: false },
);

console.log(await User.create({ name: 'AstroX11', password: '1234' }));
```

## Contributing

Your contributions help keep this project alive and growing. We appreciate any form of contribution, from bug reports to feature improvements.
