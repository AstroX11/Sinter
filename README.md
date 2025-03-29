## `native Abstract SQlite`

A lightweight, optimized ORM for SQLite, built on Node.js's native `node:sqlite` module. This library provides structured database interaction through a declarative model API inspired by Sequelize, but with significantly simpler implementation and maintenance overhead. It preserves SQLite's performance characteristics while adding strong typing, easy query building, and just enough abstraction to eliminate common boilerplate. It offers full schema definitions through all CRUD operations.

### `Geting Started`

> [!Important]
> This library requires [Node.js v23](https://nodejs.org/en/blog/release/v23.10.0) or later. Older versions (including Node.js 20 LTS) are not supported due to dependencies on the experimental `node:sqlite` module.

#### Installation

```bash
npm install abstract-sqlite-native
```

```bash
yarn add abstract-sqlite-native
```

### [`DOCS`](https://github.com/AstroX11/sqlite/wiki)