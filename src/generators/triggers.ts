import { ModelDefinition, TriggerDefinition } from '../Types.mjs';

export function generateTriggerSQL(def: ModelDefinition): string[] {
  const triggerStatements: string[] = [];
  if (!def.options?.triggers || !Array.isArray(def.options.triggers)) return triggerStatements;
  for (const trigger of def.options.triggers)
    if (trigger.name && trigger.timing && trigger.event && trigger.statements)
      triggerStatements.push(buildTriggerSQL(def.tableName, trigger) || '');
  return triggerStatements;
}

export function buildTriggerSQL(tableName: string, trigger: TriggerDefinition): string {
  const ifNotExists = trigger.ifNotExists ? 'IF NOT EXISTS ' : '';
  const timing = validateTriggerTiming(trigger.timing);
  const event = validateTriggerEvent(trigger.event);
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

export function validateTriggerTiming(timing: string): string {
  const validTimings = ['BEFORE', 'AFTER', 'INSTEAD OF'];
  const normalizedTiming = timing.toUpperCase();
  if (!validTimings.includes(normalizedTiming))
    throw new Error(
      `Invalid trigger timing: ${timing}. Must be one of: ${validTimings.join(', ')}`,
    );
  return normalizedTiming;
}

export function validateTriggerEvent(event: string): string {
  const validEvents = ['INSERT', 'UPDATE', 'DELETE'];
  const normalizedEvent = event.toUpperCase();
  if (!validEvents.includes(normalizedEvent))
    throw new Error(`Invalid trigger event: ${event}. Must be one of: ${validEvents.join(', ')}`);
  return normalizedEvent;
}
