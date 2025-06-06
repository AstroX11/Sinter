import Quantava, { DataTypes } from "quantava";

const database = new Quantava({});

const User = database.define(
  "user",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: { type: DataTypes.STRING, allowNull: false },
  },
  {
    constraints: [
      {
        type: "check",
        name: "name_length_check",
        expression: "length(name) >= 3",
      },
    ],
  }
);

const Post = database.define(
  "post",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    constraints: [
      {
        type: "check",
        name: "title_length_check",
        expression: "length(title) <= 100",
      },
    ],
  }
);

const Comment = database.define(
  "comment",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    },
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Post,
        key: "id",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    },
    content: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    constraints: [
      {
        type: "unique",
        name: "unique_user_post_comment",
        columns: ["userId", "postId", "content"],
      },
    ],
  }
);

async function runExample() {
  try {
    console.log("Test 1: Creating valid records");
    const user = await User.create({
      name: "John Doe",
      password: "secure123",
    });
    const post = await Post.create({
      userId: user.id,
      title: "First Post",
      content: "This is my first post content.",
    });
    const comment = await Comment.create({
      userId: user.id,
      postId: post.id,
      content: "Great post!",
    });
    console.log("Created user:", user);
    console.log("Created post:", post);
    console.log("Created comment:", comment);

    // Test 2: Violate unique constraint on User.name
    console.log("\nTest 2: Attempting to create user with duplicate name");
    try {
      await User.create({
        name: "John Doe",
        password: "anotherpass",
      });
      console.log("Error: Should have failed due to unique constraint");
    } catch (error) {
      console.log("Expected error (unique constraint):", error.message);
    }

    // Test 3: Violate check constraint on Post.title
    console.log("\nTest 3: Attempting to create post with too long title");
    try {
      await Post.create({
        userId: user.id,
        title: "x".repeat(101),
        content: "This title is too long.",
      });
      console.log("Error: Should have failed due to check constraint");
    } catch (error) {
      console.log("Expected error (check constraint):", error.message);
    }

    // Test 4: Violate foreign key constraint on Comment.userId
    console.log("\nTest 4: Attempting to create comment with invalid userId");
    try {
      await Comment.create({
        userId: 999,
        postId: post.id,
        content: "Invalid user comment.",
      });
      console.log("Error: Should have failed due to foreign key constraint");
    } catch (error) {
      console.log("Expected error (foreign key constraint):", error.message);
    }

    // Test 5: Violate unique constraint on Comment (userId, postId, content)
    console.log("\nTest 5: Attempting to create duplicate comment");
    try {
      await Comment.create({
        userId: user.id,
        postId: post.id,
        content: "Great post!",
      });
      console.log("Error: Should have failed due to unique constraint");
    } catch (error) {
      console.log("Expected error (unique constraint):", error.message);
    }

    // Test 6: Verify relationships
    const userPosts = await User.hasMany(Post, "userId");
    console.log("\nTest 6: User's posts:", userPosts);

    const postComments = await Post.hasMany(Comment, "postId");
    console.log("Post's comments:", postComments);

    const commentUser = await Comment.belongsTo(User, "userId");
    console.log("Comment's user:", commentUser);

    const commentPost = await Comment.belongsTo(Post, "postId");
    console.log("Comment's post:", commentPost);
  } catch (error) {
    console.error("Unexpected error:", error.message);
  }
}

runExample();
