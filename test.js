import { Database, DataTypes, Op } from './dist/src/core.js';


const db = new Database('test.db');

const User = db.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
    age: { type: DataTypes.INTEGER, validate: { min: 0, max: 120 } },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    profile: {
      type: DataTypes.JSON,
      defaultValue: { bio: 'No bio yet' },
      get: () => JSON.parse(this?.profile || '{"bio": "No bio yet"}'),
    },
    createdAt: { type: DataTypes.DATE},
  },
  {
    hooks: {
      beforeCreate: (user) => console.log('Before creating user:', user),
      afterUpdate: (user) => console.log('After updating user:', user),
    },
  },
);

const Post = db.define('Post', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  userId: { type: DataTypes.INTEGER },
});

const Group = db.define('Group', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false },
});

// Associations
User.hasMany(Post, { foreignKey: 'userId' });
Post.belongsTo(User, { foreignKey: 'userId' });
User.belongsToMany(Group, { through: 'UserGroup', foreignKey: 'userId' });
Group.belongsToMany(User, { through: 'UserGroup', foreignKey: 'groupId' });

// Test Function
async function runTests() {
  console.log('=== Starting Tests ===');

  // 1. Create Tables
  console.log('Creating tables...');
  User.createTable();
  Post.createTable();
  Group.createTable();

  // 2. Test CRUD Operations
  console.log('\n=== CRUD Operations ===');
  const alice = User.add({ name: 'alice@example.com', age: 25 });
  console.log('Added user:', alice);

  const bob = User.add({ name: 'bob@example.com', age: 30 });
  console.log('Added user:', bob);

  const post1 = Post.add({ title: 'Alice Post 1', userId: alice.id });
  console.log('Added post:', post1);

  console.log('All users:', User.all());
  console.log('One user:', User.one({ where: { name: 'alice@example.com' } }));

  User.update({ age: 26 }, { where: { name: 'alice@example.com' } });
  console.log('Updated user:', User.one({ where: { name: 'alice@example.com' } }));

  User.delete({ where: { name: 'bob@example.com' } });
  console.log('All users after delete:', User.all());

  // 3. Test Associations
  console.log('\n=== Associations ===');
  console.log('Users with posts (hasMany):', User.all({ include: [Post] }));
  console.log('Post with user (belongsTo):', Post.all({ include: [User] }));

  const devs = Group.add({ name: 'Developers' });
  db.raw.exec(`INSERT INTO "UserGroup" ("userId", "groupId") VALUES (${alice.id}, ${devs.id})`);
  console.log('Users with groups (belongsToMany):', User.all({ include: [Group] }));

  // 4. Test Transactions
  console.log('\n=== Transactions ===');
  const result = db.transaction((t) => {
    const charlie = User.add({ name: 'charlie@example.com', age: 35 });
    const post2 = Post.add({ title: 'Charlie Post', userId: charlie.id });
    return { charlie, post2 };
  });
  console.log('Transaction result:', result);

  // 5. Test Operators
  console.log('\n=== Operators ===');
  console.log('Users > 25:', User.all({ where: { age: { [Op.gt]: 25 } } }));
  console.log(
    'Users with "alice" in name:',
    User.all({ where: { name: { [Op.like]: '%alice%' } } }),
  );

  // 6. Test Validation
  console.log('\n=== Validation ===');
  try {
    User.add({ name: 'invalid', age: 150 }); // Should fail
  } catch (e) {
    console.log('Validation error:', e.message);
  }

  // 7. Test Data Types and Getters
  console.log('\n=== Data Types and Getters ===');
  const dave = User.add({
    name: 'dave@example.com',
    age: 40,
    profile: { bio: 'Software Engineer' },
  });
  console.log('User with JSON profile:', dave.profile); // Should be parsed
  console.log('User active status:', dave.active); // Should be boolean
  console.log('User createdAt:', dave.createdAt); // Should be date string

  // 8. Test Utility Methods
  console.log('\n=== Utility Methods ===');
  console.log('Count users:', User.count());
  console.log('Max age:', User.max('age'));
  console.log('Min age:', User.min('age'));
  console.log('Find by PK:', User.findByPk(alice.id));

  const [eve, created] = User.findOrCreate({
    where: { name: 'eve@example.com' },
    defaults: { age: 28 },
  });
  console.log('Find or create:', eve, 'Created:', created);

  User.bulkAdd([
    { name: 'frank@example.com', age: 45 },
    { name: 'grace@example.com', age: 50 },
  ]);
  console.log('All users after bulk add:', User.all());

  // Speed Test
  console.log('\n=== Speed Test ===');
  const start = performance.now();
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    User.add({ name: `user${i}@example.com`, age: 20 + (i % 50) });
  }
  const addTime = performance.now() - start;
  console.log(
    `Added ${iterations} users in ${addTime.toFixed(2)} ms (${(addTime / iterations).toFixed(
      2,
    )} ms per add)`,
  );

  const readStart = performance.now();
  User.all();
  const readTime = performance.now() - readStart;
  console.log(`Read all users (${User.count()}) in ${readTime.toFixed(2)} ms`);

  const joinStart = performance.now();
  User.all({ include: [Post] });
  const joinTime = performance.now() - joinStart;
  console.log(`Read all users with posts in ${joinTime.toFixed(2)} ms`);

  console.log('=== Tests Completed ===');
  db.close();
}

runTests().catch(console.error);
