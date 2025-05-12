import { Database, DataType } from '@astrox11/sqlite';

// Initialize in-memory database
const db = new Database(':memory:', { journalMode: 'WAL' });

// Define User schema
const userSchema = {
	id: { type: DataType.INTEGER, primaryKey: true, autoIncrement: true },
	name: { type: DataType.STRING, allowNull: false },
};

// Define Post schema with reference to User
const postSchema = {
	id: { type: DataType.INTEGER, primaryKey: true, autoIncrement: true },
	title: { type: DataType.STRING, allowNull: false },
	userId: {
		type: DataType.INTEGER,
		references: { model: 'users', key: 'id' },
		allowNull: false,
		onDelete: 'CASCADE',
	},
};

// Define models
const User = db.define('users', userSchema, { timestamps: true });
const Post = db.define('posts', postSchema, { timestamps: true });

// Define relationships
db.associate(() => {
	Post.belongsTo(User, { foreignKey: 'userId', as: 'author' });
	User.hasMany(Post, { foreignKey: 'userId', as: 'posts' });
});

// Test function
async function runTests() {
	console.log('Starting relationship tests...');

	try {
		// Test 1: Create a user and posts
		console.log('Test 1: Creating user and posts');
		const user = await User.create({ name: 'Alice' });
		console.log('Created user:', user);

		const post1 = await Post.create({ title: 'First Post', userId: user.id });
		const post2 = await Post.create({ title: 'Second Post', userId: user.id });
		console.log('Created posts:', post1, post2);

		// Test 2: Fetch user with posts (hasMany)
		console.log('Test 2: Fetching user with posts');
		const userWithPosts = await User.findOne({
			where: { id: user.id },
			include: [{ model: Post, as: 'posts' }],
		});
		console.log('User with posts:', JSON.stringify(userWithPosts, null, 2));
		if (!userWithPosts.posts || userWithPosts.posts.length !== 2) {
			throw new Error(
				`Expected 2 posts for user, got ${
					userWithPosts.posts ? userWithPosts.posts.length : 'undefined'
				}`,
			);
		}

		// Test 3: Fetch post with author (belongsTo)
		console.log('Test 3: Fetching post with author');
		const postWithAuthor = await Post.findOne({
			where: { id: post1.id },
			include: [{ model: User, as: 'author' }],
		});
		console.log('Post with author:', JSON.stringify(postWithAuthor, null, 2));
		if (!postWithAuthor.author || postWithAuthor.author.name !== 'Alice') {
			throw new Error('Expected author name to be Alice');
		}

		// Test 4: Use getRelated for belongsTo
		console.log('Test 4: Using getRelated for post author');
		const author = await Post.getRelated(post1, 'author');
		console.log('Post author:', author);
		if (!author || author.name !== 'Alice') {
			throw new Error('Expected related author name to be Alice');
		}

		// Test 5: Use getRelated for hasMany
		console.log('Test 5: Using getRelated for user posts');
		const posts = await User.getRelated(user, 'posts');
		console.log('User posts:', posts);
		if (!posts || posts.length !== 2) {
			throw new Error('Expected 2 related posts');
		}

		// Test 6: Use setRelated for belongsTo
		console.log('Test 6: Using setRelated to change post author');
		const newUser = await User.create({ name: 'Bob' });
		await Post.setRelated(post1, 'author', newUser);
		const updatedPost = await Post.findByPk(post1.id);
		console.log('Updated post:', updatedPost);
		if (updatedPost.userId !== newUser.id) {
			throw new Error('Expected post userId to be updated to Bob’s id');
		}

		// Test 7: Use setRelated for hasMany
		console.log('Test 7: Using setRelated to assign posts to user');
		const newPost = await Post.create({ title: 'Third Post', userId: user.id });
		await User.setRelated(newUser, 'posts', [newPost]);
		const newUserPosts = await User.getRelated(newUser, 'posts');
		console.log('New user posts:', newUserPosts);
		if (newUserPosts.length !== 1 || newUserPosts[0].title !== 'Third Post') {
			throw new Error('Expected new user to have one post titled "Third Post"');
		}

		// Test 8: Test schema references without explicit belongsTo
		console.log('Test 8: Fetching post with author using schema references');
		const postWithRefAuthor = await Post.findOne({
			where: { id: post2.id },
			include: [{ model: User, as: 'users' }],
		});
		console.log(
			'Post with ref author:',
			JSON.stringify(postWithRefAuthor, null, 2),
		);
		if (!postWithRefAuthor.users || postWithRefAuthor.users.name !== 'Alice') {
			throw new Error('Expected ref author name to be Alice');
		}

		console.log('All tests passed!');
	} catch (error) {
		console.error('Test failed:', error.message);
		console.error(error.stack);
	} finally {
		db.close();
	}
}

// Run tests
runTests();
