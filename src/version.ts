export const ensureNode23 = () => {
  const version = process.versions.node.split('.').map(Number);
  if (version[0] < 23) {
    throw new Error('Node.js version 23 or higher is required.');
  }
};
