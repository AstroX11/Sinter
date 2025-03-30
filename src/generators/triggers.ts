import { ModelDefinition, TriggerDefinition } from '../Types.mjs';

/**
 * Generates SQLite CREATE TRIGGER statements from a model definition
 * @param def The model definition object
 * @returns An array of CREATE TRIGGER statements
 */
export function generateTriggerSQL(def: ModelDefinition): string[] {
  const triggerStatements: string[] = [];
  if (!def.options?.triggers || !Array.isArray(def.options.triggers)) return triggerStatements;
  for (const trigger of def.options.triggers)
    if (trigger.name && trigger.timing && trigger.event && trigger.statements)
      triggerStatements.push(buildTriggerSQL(def.tableName, trigger) || '');
  return triggerStatements;
}

/**
 * Builds a single CREATE TRIGGER statement
 * @param tableName The table name
 * @param trigger The trigger definition object
 * @returns A CREATE TRIGGER statement
 */
function buildTriggerSQL(tableName: string, trigger: TriggerDefinition): string {
  const ifNotExists = trigger.ifNotExists ? 'IF NOT EXISTS ' : '',
    timing = validateTriggerTiming(trigger.timing),
    event = validateTriggerEvent(trigger.event);
  let sql = `CREATE TRIGGER ${ifNotExists}${trigger.name} ${timing} ${event} ON ${tableName} `;
  if (event === 'UPDATE' && trigger.columns && trigger.columns.length > 0)
    sql += `OF ${trigger.columns.join(', ')} `;
  if (trigger.condition) sql += `WHEN ${trigger.condition} `;
  return (sql +=
    trigger.statements && trigger.statements.length > 0
      ? `BEGIN ${trigger.statements
          .map((stmt) => (stmt.trim().endsWith(';') ? stmt.trim() : `${stmt.trim()};`))
          .join(' ')} END`
      : 'BEGIN END');
}

/**
 * Validates and normalizes trigger timing
 * @param timing The trigger timing string
 * @returns A validated trigger timing
 */
function validateTriggerTiming(timing: string): string {
  const validTimings = ['BEFORE', 'AFTER', 'INSTEAD OF'],
    normalizedTiming = timing.toUpperCase();
  if (!validTimings.includes(normalizedTiming))
    throw new Error(
      `Invalid trigger timing: ${timing}. Must be one of: ${validTimings.join(', ')}`,
    );
  return normalizedTiming;
}

/**
 * Validates and normalizes trigger event
 * @param event The trigger event string
 * @returns A validated trigger event
 */
function validateTriggerEvent(event: string): string {
  const validEvents = ['INSERT', 'UPDATE', 'DELETE'],
    normalizedEvent = event.toUpperCase();
  if (!validEvents.includes(normalizedEvent))
    throw new Error(`Invalid trigger event: ${event}. Must be one of: ${validEvents.join(', ')}`);
  return normalizedEvent;
}
