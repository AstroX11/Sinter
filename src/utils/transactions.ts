import type { DatabaseSync } from 'node:sqlite';
import type { TransactionOptions } from '../Types.mjs';

const activeTransactions = new Map<string, DatabaseSync>();

/**
 * Starts a new transaction
 * @param db Database connection
 * @param options Transaction options
 * @returns Transaction ID
 */
export function startTransaction(db: DatabaseSync, options: TransactionOptions = {}): string {
  const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const isolationLevel = options.isolationLevel || 'DEFERRED';

  const beginStmt = db.prepare(`BEGIN ${isolationLevel} TRANSACTION`);
  beginStmt.run();

  activeTransactions.set(txId, db);

  if (options.timeout && options.timeout > 0) {
    setTimeout(() => {
      if (activeTransactions.has(txId)) {
        try {
          const rollbackStmt = db.prepare('ROLLBACK');
          rollbackStmt.run();
          activeTransactions.delete(txId);
        } catch (error) {
          console.error(`Failed to rollback timed-out transaction ${txId}:`, error);
        }
      }
    }, options.timeout);
  }

  return txId;
}

/**
 * Commits a transaction
 * @param txId Transaction ID
 */
export function commitTransaction(txId: string): void {
  const db = activeTransactions.get(txId);

  if (!db) {
    throw new Error(`Transaction ${txId} not found or already completed`);
  }

  try {
    const commitStmt = db.prepare('COMMIT');
    commitStmt.run();
  } finally {
    activeTransactions.delete(txId);
  }
}

/**
 * Rolls back a transaction
 * @param txId Transaction ID
 */
export function rollbackTransaction(txId: string): void {
  const db = activeTransactions.get(txId);

  if (!db) {
    throw new Error(`Transaction ${txId} not found or already completed`);
  }

  try {
    const rollbackStmt = db.prepare('ROLLBACK');
    rollbackStmt.run();
  } finally {
    activeTransactions.delete(txId);
  }
}

/**
 * Gets the database connection for a transaction
 * @param db Default database connection
 * @param txId Transaction ID
 * @returns Database connection
 */
export function getTransaction(db: DatabaseSync, txId: string): DatabaseSync {
  const txDb = activeTransactions.get(txId);

  if (!txDb) {
    throw new Error(`Transaction ${txId} not found or already completed`);
  }

  return txDb;
}
