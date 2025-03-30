/**
 * Executes an array of hook functions in sequence
 * @param hooks Array of hook functions to execute
 * @param data Data to pass to each hook
 */
export async function executeHooks(
  hooks: Array<(data: any) => Promise<void> | void>,
  data: any,
): Promise<void> {
  if (!hooks || !Array.isArray(hooks) || hooks.length === 0) {
    return;
  }

  // Create a deep copy of data to prevent accidental mutations by hooks
  const dataCopy = JSON.parse(JSON.stringify(data));

  for (const hook of hooks) {
    try {
      // Execute hook - may be synchronous or async
      const result = hook(data);

      // If hook returns a promise, await it
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      throw new Error(
        `Hook execution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
