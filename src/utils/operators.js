/**
 * Operators for querying in a database or ORM.
 * These operators can be used to build complex, expressive queries.
 */
export const Op = {
	/**
	 * Less than: value < givenValue
	 * Example: where: { age: { [Op.lt]: 30 } }
	 */
	lt: Symbol("lt"),

	/**
	 * Less than or equal: value <= givenValue
	 * Example: where: { age: { [Op.lte]: 30 } }
	 */
	lte: Symbol("lte"),

	/**
	 * Greater than: value > givenValue
	 * Example: where: { age: { [Op.gt]: 30 } }
	 */
	gt: Symbol("gt"),

	/**
	 * Greater than or equal: value >= givenValue
	 * Example: where: { age: { [Op.gte]: 30 } }
	 */
	gte: Symbol("gte"),

	/**
	 * Not equal: value != givenValue
	 * Example: where: { age: { [Op.ne]: 30 } }
	 */
	ne: Symbol("ne"),

	/**
	 * Equal: value === givenValue
	 * Example: where: { age: { [Op.eq]: 30 } }
	 */
	eq: Symbol("eq"),

	/**
	 * In: value is in a set of given values
	 * Example: where: { name: { [Op.in]: ['Alice', 'Bob'] } }
	 */
	in: Symbol("in"),

	/**
	 * Not in: value is NOT in a set of given values
	 * Example: where: { name: { [Op.notIn]: ['Alice', 'Bob'] } }
	 */
	notIn: Symbol("notIn"),

	/**
	 * Like: value matches a pattern (supports SQL wildcards)
	 * Example: where: { name: { [Op.like]: 'A%' } }
	 */
	like: Symbol("like"),

	/**
	 * Not like: value does NOT match a pattern
	 * Example: where: { name: { [Op.notLike]: 'A%' } }
	 */
	notLike: Symbol("notLike"),

	/**
	 * Is: value IS (often for NULL or boolean checks)
	 * Example: where: { bio: { [Op.is]: null } }
	 */
	is: Symbol("is"),

	/**
	 * Between: value is between two given values (inclusive)
	 * Example: where: { age: { [Op.between]: [18, 30] } }
	 */
	between: Symbol("between"),

	/**
	 * Not between: value is NOT between two given values
	 * Example: where: { age: { [Op.notBetween]: [18, 30] } }
	 */
	notBetween: Symbol("notBetween"),

	/**
	 * Overlap: used with array or range types to check if they overlap
	 * Example: where: { tags: { [Op.overlap]: ['tag1', 'tag2'] } }
	 */
	overlap: Symbol("overlap"),

	/**
	 * Contains: checks if array or JSON contains given element
	 * Example: where: { data: { [Op.contains]: { key: 'value' } } }
	 */
	contains: Symbol("contains"),

	/**
	 * Contained: checks if value is contained within another (inverse of contains)
	 * Example: where: { data: { [Op.contained]: ['value1', 'value2'] } }
	 */
	contained: Symbol("contained"),

	/**
	 * Raw SQL fragment or custom operator placeholder
	 * Use with caution and proper sanitization.
	 */
	raw: Symbol("raw"),

	/**
	 * And: Logical AND operator for combining multiple conditions
	 * Example: where: { [Op.and]: [{ age: { [Op.gt]: 20 } }, { name: { [Op.like]: 'A%' } }] }
	 */
	and: Symbol("and"),

	/**
	 * Or: Logical OR operator for combining multiple conditions
	 * Example: where: { [Op.or]: [{ age: { [Op.lt]: 18 } }, { age: { [Op.gt]: 65 } }] }
	 */
	or: Symbol("or"),

	/**
	 * Not: Logical NOT operator for negating a condition
	 * Example: where: { age: { [Op.not]: { [Op.lt]: 18 } } }
	 */
	not: Symbol("not"),
};
