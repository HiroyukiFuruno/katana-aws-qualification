import { parseStoredAttempts } from './attemptCodec';

const emptyHistory = '[]';

function rows(raw: string) {
  const parsed = parseStoredAttempts(raw);
  if (parsed.corruptRows > 0) throw new Error('Guest history is corrupt.');
  return parsed.attempts;
}

function suffixAfterBase(full: string, base: string) {
  const fullRows = rows(full);
  const baseRows = rows(base);
  if (baseRows.some((row, index) => JSON.stringify(row) !== JSON.stringify(fullRows[index]))) {
    throw new Error('Guest history base is not a prefix.');
  }
  return fullRows.slice(baseRows.length);
}

export class GuestHistoryMemory {
  #full: string | undefined;
  #base = emptyHistory;

  clear() {
    this.#full = undefined;
    this.#base = emptyHistory;
  }

  hasPending() {
    return this.#full !== undefined;
  }

  read(disk: string | null, persisted: boolean) {
    if (!persisted) {
      if (this.#full === undefined) this.#base = emptyHistory;
      else rows(this.#full);
      return this.#full ?? null;
    }
    const currentDisk = disk ?? emptyHistory;
    if (this.#full === undefined) {
      this.#base = currentDisk;
      return disk;
    }
    rows(currentDisk);
    const merged = JSON.stringify([...rows(currentDisk), ...suffixAfterBase(this.#full, this.#base)]);
    this.#full = merged;
    this.#base = currentDisk;
    return merged;
  }

  remember(value: string) {
    this.#full = value;
  }

  persist(disk: string | null, full: string) {
    const currentDisk = disk ?? emptyHistory;
    const merged = JSON.stringify([...rows(currentDisk), ...suffixAfterBase(full, this.#base)]);
    this.#full = merged;
    this.#base = currentDisk;
    return merged;
  }

  flush(disk: string | null, write: (value: string) => 'blocked' | 'failed' | 'saved') {
    return this.#full === undefined ? 'saved' : this.save(disk, this.#full, write);
  }

  save(disk: string | null, value: string, write: (value: string) => 'blocked' | 'failed' | 'saved') {
    const full = this.#full;
    const base = this.#base;
    try {
      const result = write(this.persist(disk, value));
      if (result === 'saved') this.clear();
      if (result === 'failed') {
        this.#full = full;
        this.#base = base;
      }
      return result;
    } catch {
      this.#full = full;
      this.#base = base;
      return 'failed';
    }
  }
}
