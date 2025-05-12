import { Database, DataType } from '@astrox11/sqlite';

const db = new Database(':memory:');

const User = db.define('user', {
	id: { type: DataType.INTEGER, primaryKey: true, autoIncrement: true },
	name: DataType.STRING,
});

const Comment = db.define('comments', {
	id: { type: DataType.INTEGER, primaryKey: true, autoIncrement: true },
	content: DataType.STRING,
	userId: { type: DataType.INTEGER, allowNull: false },
});

User.hasMany(Comment, {
	foreignKey: 'userId',
	as: 'comments',
});

Comment.belongsTo(User, {
	foreignKey: 'userId',
	as: 'user',
});

db.associate(() => {
	User.hasMany(Comment, {
		foreignKey: 'userId',
		as: 'comments',
	});

	Comment.belongsTo(User, {
		foreignKey: 'userId',
		as: 'user',
	});
});

(async () => {
	const newUser = await User.create({ name: 'John Doe' });
	const newComment1 = await Comment.create({
		content: 'This is the first comment!',
		userId: newUser.id,
	});
	const newComment2 = await Comment.create({
		content: 'This is the second comment!',
		userId: newUser.id,
	});

	const userWithComments = await User.findByPk(newUser.id, {
		include: [
			{
				model: Comment,
				as: 'comments',
			},
		],
	});

	console.log(userWithComments);

	const commentWithUser = await Comment.findByPk(newComment1.id, {
		include: [
			{
				model: User,
				as: 'user',
			},
		],
	});

	console.log(commentWithUser);
})();
