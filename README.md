# Abstract SQLite Native

**Abstract SQLite Native** is a lightweight, TypeScript-first SQLite ORM and query builder that simplifies database operations while maintaining flexibility and performance. Built on top of Node.js's experimental `node:sqlite` module, it offers a Sequelize-inspired API with strong typing, configurable database options, and SQLite-specific optimizations.

## Table of Contents
1. [Purpose](#purpose)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Basic Usage](#basic-usage)
   - [Initializing the Database](#initializing-the-database)
   - [Defining a Model](#defining-a-model)
   - [Performing CRUD Operations](#performing-crud-operations)
5. [Advanced Features](#advanced-features)
   - [Transactions](#transactions)
   - [Raw Queries](#raw-queries)
   - [Migrations](#migrations)
   - [Database Maintenance](#database-maintenance)
   - [Custom Functions](#custom-functions)
6. [API Reference](#api-reference)
   - [DatabaseManager](#databasemanager)
   - [Model Methods](#model-methods)
7. [Example Project](#example-project)

---

## Purpose

Abstract SQLite Native aims to:
- Provide a simple, type-safe abstraction over SQLite for Node.js applications.
- Offer configurable database-level settings (e.g., caching, timestamps, table prefixes).
- Support common ORM features like CRUD operations, transactions, and migrations.
- Optimize SQLite performance with sensible defaults and caching options.

It’s ideal for developers who need a lightweight database solution with persistence, strong typing, and modern JavaScript/TypeScript support.

---

## Installation

### Prerequisites
- Node.js 20+ (due to experimental SQLite support)
- TypeScript (optional but recommended for type safety)
- Yarn or npm

### Steps
1. Install the package (assuming it’s published; for now, use the source file):
   ```bash
   yarn add abstract-sqlite-native
   ```
   Or, if using the source directly:
   ```bash
   cp path/to/database.mts ./model/database.mts
   ```

2. Ensure TypeScript is configured with ES modules (if using TypeScript):
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "module": "ESNext",
       "target": "ESNext",
       "moduleResolution": "Node",
       "esModuleInterop": true,
       "strict": true
     }
   }
   ```

3. Run your script with `--esm` flag for ES module support:
   ```bash
   yarn ts-node --esm your-script.ts
   ```

---

## Configuration

The `DatabaseManager` constructor accepts a location and an optional `DatabaseConfig` object to customize database behavior.

### DatabaseConfig Options
| Option                  | Type                                      | Default         | Description                                                                 |
|-------------------------|-------------------------------------------|-----------------|-----------------------------------------------------------------------------|
| `defaultPrimaryKey`     | `string`                                  | `'id'`          | Default name for primary key columns if not specified.                      |
| `autoIncrementByDefault`| `boolean`                                 | `true`          | Whether primary keys auto-increment by default.                            |
| `tableNamePrefix`       | `string`                                  | `''`            | Prefix applied to all table names (e.g., `'app_'` → `app_users`).          |
| `addTimestampsByDefault`| `boolean`                                 | `false`         | Adds `createdAt` and `updatedAt` columns to all tables automatically.      |
| `busyTimeout`           | `number`                                  | `5000`          | Timeout (ms) for busy database operations.                                 |
| `journalMode`           | `'DELETE' \| 'TRUNCATE' \| ... \| 'OFF'` | `'WAL'`         | SQLite journal mode (WAL recommended for concurrency).                     |
| `enableDefaultCache`    | `boolean`                                 | `false`         | Enables optimized caching settings (e.g., 80MB cache, 256MB mmap).         |
| `readOnly`              | `boolean`                                 | `false`         | Opens the database in read-only mode if `true`.                            |
| `open`                  | `boolean`                                 | `true`          | Opens the database connection immediately.                                 |

### Example Configuration
```typescript
import { DatabaseManager } from './model/database.mts';

const db = new DatabaseManager('./mydb.sqlite', {
  tableNamePrefix: 'app_',
  addTimestampsByDefault: true,
  enableDefaultCache: true,
  journalMode: 'WAL',
});
```

---

## Basic Usage

### Initializing the Database
Create a `DatabaseManager` instance with a file path (persistent) or `':memory:'` (in-memory).

```typescript
import { DatabaseManager } from './model/database.mts';

const db = new DatabaseManager('./mydb.sqlite');
```

### Defining a Model
Use the `define` method to create a table with a schema. The schema specifies column definitions.

```typescript
const User = db.define<{ id: number; name: string; age: number }>('users', {
  name: { type: 'TEXT', nullable: false },
  age: { type: 'INTEGER', defaultValue: 0 },
});
```

If no primary key is specified, `id` (or the configured `defaultPrimaryKey`) is added with `autoIncrement`.

### Performing CRUD Operations

#### Create
```typescript
User.create({ name: 'John', age: 30 });
```

#### Read
```typescript
const user = User.findOne({ where: { name: 'John' } });
console.log(user); // { id: 1, name: 'John', age: 30 }
const allUsers = User.findAll();
```

#### Update
```typescript
User.update({ age: 31 }, { name: 'John' });
```

#### Delete
```typescript
User.delete({ name: 'John' });
```

---

## Advanced Features

### Transactions
Wrap operations in a transaction for atomicity.
```typescript
db.transaction((tx) => {
  const User = tx.getModel<{ id: number; name: string }>('users')!;
  User.create({ name: 'Alice' });
  User.create({ name: 'Bob' });
});
```

### Raw Queries
Execute custom SQL.
```typescript
const rows = db.raw<{ id: number; name: string }>('SELECT * FROM users WHERE age > ?', [25]);
console.log(rows);
```

### Migrations
Apply schema changes.
```typescript
db.migrate([
  { up: 'CREATE TABLE logs (id INTEGER PRIMARY KEY, message TEXT)', down: 'DROP TABLE logs' },
]);
```

### Database Maintenance
Optimize and backup the database.
```typescript
db.vacuum(); // Compact the database
db.analyze(); // Update query statistics
db.backup('./backup.sqlite'); // Create a backup
```

### Custom Functions
Add SQLite custom functions.
```typescript
db.addFunction('myFunc', (a: number, b: number) => a + b);
const result = db.raw<{ value: number }>('SELECT myFunc(2, 3) as value')[0];
console.log(result.value); // 5
```

---

## API Reference

### DatabaseManager
| Method/Property          | Description                                      | Signature                                      |
|--------------------------|--------------------------------------------------|------------------------------------------------|
| `constructor`            | Initializes the database.                       | `(location: string, config?: DatabaseConfig)`  |
| `define`                 | Defines a new table and returns a model.        | `<T>(tableName: string, schema: Schema): Model<T>` |
| `getModel`               | Retrieves a defined model.                      | `<T>(tableName: string): Model<T> \| undefined` |
| `transaction`            | Executes a transactional block.                 | `<T>(callback: (db: DatabaseManager) => T): T` |
| `raw`                    | Runs a raw SQL query.                           | `<T>(sql: string, params?: SupportedValueType[]): T[]` |
| `migrate`                | Applies migrations.                             | `(migrations: { up: string; down: string }[])` |
| `vacuum`                 | Compacts the database.                          | `(): void`                                     |
| `analyze`                | Updates query statistics.                       | `(): void`                                     |
| `backup`                 | Backs up the database to a file.                | `(toLocation: string): void`                   |
| `close`                  | Closes the database connection.                 | `(): void`                                     |
| `addFunction`            | Registers a custom SQLite function.             | `(name: string, fn: (...args: SupportedValueType[]) => SupportedValueType, options?: FunctionOptions)` |

### Model Methods
| Method            | Description                                      | Signature                                      |
|-------------------|--------------------------------------------------|------------------------------------------------|
| `create`          | Inserts a single record.                        | `(data: Partial<T>): StatementResultingChanges` |
| `bulkCreate`      | Inserts multiple records.                       | `(data: Partial<T>[]): StatementResultingChanges` |
| `findAll`         | Retrieves all matching records.                 | `(options?: QueryOptions): T[]`                |
| `findOne`         | Retrieves one matching record.                  | `(options?: QueryOptions): T \| undefined`     |
| `findById`        | Retrieves a record by primary key.              | `(id: number \| bigint): T \| undefined`       |
| `findOrCreate`    | Finds or creates a record.                      | `(options: FindOrCreateOptions<T>): [T, boolean]` |
| `update`          | Updates matching records.                       | `(data: Partial<T>, where: WhereClause): StatementResultingChanges` |
| `upsert`          | Updates or inserts a record.                    | `(data: Partial<T>): StatementResultingChanges` |
| `delete`          | Deletes matching records.                       | `(where: WhereClause): StatementResultingChanges` |
| `destroy`         | Deletes records or truncates table.             | `(options?: DestroyOptions): StatementResultingChanges` |
| `count`           | Counts matching records.                        | `(where?: WhereClause): number`                |
| `max`             | Gets the maximum value of a field.              | `(field: keyof T, where?: WhereClause): number \| bigint \| undefined` |
| `min`             | Gets the minimum value of a field.              | `(field: keyof T, where?: WhereClause): number \| bigint \| undefined` |
| `sum`             | Sums a field’s values.                          | `(field: keyof T, where?: WhereClause): number \| bigint \| undefined` |
| `increment`       | Increments field values.                        | `(fields: keyof T \| (keyof T)[], where: WhereClause): StatementResultingChanges` |
| `decrement`       | Decrements field values.                        | `(fields: keyof T \| (keyof T)[], where: WhereClause): StatementResultingChanges` |

---

## Example Project

Here’s a complete example demonstrating periodic writes to a file-based database:

```typescript
import { DatabaseManager } from './model/database.mts';

const names = ['John', 'Jane', 'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];

const db = new DatabaseManager('./testdb.sqlite', {
  addTimestampsByDefault: true,
  enableDefaultCache: true,
});

const User = db.define<{
  id: number;
  name: string;
  age: number;
  createdAt: number;
  updatedAt: number;
}>('users', {
  name: { type: 'TEXT', nullable: false },
  age: { type: 'INTEGER', defaultValue: 0 },
});

function generateRandomUser(index: number) {
  const name = names[index % names.length];
  const age = 20 + (index % 50);
  return { name, age };
}

console.log('Initial insertions:');
User.create({ name: 'John', age: 30 });
console.log(User.findOne({ where: { name: 'John' } }));

let counter = 0;
setInterval(() => {
  const userData = generateRandomUser(counter);
  User.create(userData);
  console.log(`Insert #${counter + 1}:`, User.findAll());
  counter++;
}, 5000);

process.on('SIGINT', () => {
  console.log('Closing database...');
  db.close();
  process.exit(0);
});
```

This creates a `testdb.sqlite` file, adds users every 5 seconds, and persists data across runs.

---

This documentation provides a comprehensive guide to using **Abstract SQLite Native**. Let me know if you’d like to refine any section or add more details!
