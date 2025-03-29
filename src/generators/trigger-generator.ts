// trigger-generator.ts
import { ModelDefinition, TriggerDefinition } from '../Types.mjs';

/**
 * Generates SQLite CREATE TRIGGER statements from a model definition
 * 
 * @param def The model definition object
 * @returns An array of CREATE TRIGGER statements
 */
export function generateTriggerSQL(def: ModelDefinition): string[] {
  const triggerStatements: string[] = [];
  
  if (!def.options?.triggers || !Array.isArray(def.options.triggers)) {
    return triggerStatements;
  }
  
  for (const trigger of def.options.triggers) {
    if (!trigger.name || !trigger.timing || !trigger.event || !trigger.statements) {
      continue;
    }
    
    const triggerSQL = buildTriggerSQL(def.tableName, trigger);
    if (triggerSQL) {
      triggerStatements.push(triggerSQL);
    }
  }
  
  return triggerStatements;
}

/**
 * Builds a single CREATE TRIGGER statement
 * 
 * @param tableName The table name
 * @param trigger The trigger definition object
 * @returns A CREATE TRIGGER statement
 */
function buildTriggerSQL(tableName: string, trigger: TriggerDefinition): string {
  const ifNotExists = trigger.ifNotExists ? 'IF NOT EXISTS ' : '';
  
  // Validate and normalize timing
  const timing = validateTriggerTiming(trigger.timing);
  
  // Validate and normalize event
  const event = validateTriggerEvent(trigger.event);
  
  // Build the CREATE TRIGGER statement
  let sql = `CREATE TRIGGER ${ifNotExists}${trigger.name} `;
  sql += `${timing} ${event} ON ${tableName} `;
  
  // Add columns for UPDATE OF if specified
  if (event === 'UPDATE' && trigger.columns && trigger.columns.length > 0) {
    sql += `OF ${trigger.columns.join(', ')} `;
  }
  
  // Add WHEN clause if provided
  if (trigger.condition) {
    sql += `WHEN ${trigger.condition} `;
  }
  
  // Add trigger body
  if (trigger.statements && trigger.statements.length > 0) {
    // Make sure statements end with semicolons
    const formattedStatements = trigger.statements.map(stmt => 
      stmt.trim().endsWith(';') ? stmt.trim() : `${stmt.trim()};`
    );
    
    sql += `BEGIN ${formattedStatements.join(' ')} END`;
  } else {
    sql += 'BEGIN END'; // Empty trigger body
  }
  
  return sql;
}

/**
 * Validates and normalizes trigger timing
 * 
 * @param timing The trigger timing string
 * @returns A validated trigger timing
 */
function validateTriggerTiming(timing: string): string {
  const validTimings = ['BEFORE', 'AFTER', 'INSTEAD OF'];
  const normalizedTiming = timing.toUpperCase();
  
  if (!validTimings.includes(normalizedTiming)) {
    throw new Error(`Invalid trigger timing: ${timing}. Must be one of: ${validTimings.join(', ')}`);
  }
  
  return normalizedTiming;
}

/**
 * Validates and normalizes trigger event
 * 
 * @param event The trigger event string
 * @returns A validated trigger event
 */
function validateTriggerEvent(event: string): string {
  const validEvents = ['INSERT', 'UPDATE', 'DELETE'];
  const normalizedEvent = event.toUpperCase();
  
  if (!validEvents.includes(normalizedEvent)) {
    throw new Error(`Invalid trigger event: ${event}. Must be one of: ${validEvents.join(', ')}`);
  }
  
  return normalizedEvent;
}