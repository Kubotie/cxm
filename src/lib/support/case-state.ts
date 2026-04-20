// ─── Case State Store ─────────────────────────────────────────────────────────
// Module-level optimistic mutation store for Support cases.
//
// Architecture
// ────────────
// All UI components depend only on the public functions / useCaseState() hook.
// The CaseStateAdapter interface is the persistence boundary.
// Swapping to a real API requires only replacing the `adapter` singleton below —
// no changes needed in any UI component.
//
// Persistence targets (API adapter will persist these):
//   dismissCase       → POST   /api/support/:id/dismiss
//   undismissCase     → DELETE /api/support/:id/dismiss
//   createAction      → POST   /api/support/:id/action
//   createCseTicket   → POST   /api/support/:id/cse-ticket
//   bulkDismiss       → POST   /api/support/bulk/dismiss
//   bulkCreateAction  → POST   /api/support/bulk/action
//   bulkCreateCseTicket → POST /api/support/bulk/cse-ticket
//
// Read-only functions (getCaseRecord, isDismissed, getDismissedIds) will query
// the API or a local cache — no separate persistence endpoint needed.

import { useState, useEffect, useCallback } from "react";

// ── Record types ──────────────────────────────────────────────────────────────

export interface DismissRecord {
  active:           boolean;        // false after undismiss (audit trail preserved)
  dismissed_at:     string;         // ISO-8601
  dismissed_by:     string | null;
  dismissed_reason: string | null;
  undismissed_at:   string | null;
  undismissed_by:   string | null;
}

export type ActionStatus = "draft" | "open" | "in_progress" | "done";

export interface ActionRecord {
  created_at: string;               // ISO-8601
  updated_at: string;
  action_id:  string | null;
  status:     ActionStatus;
  owner:      string | null;
  title:      string | null;
}

export type CseTicketStatus = "open" | "waiting" | "investigating" | "resolved";

export interface CseTicketRecord {
  created_at: string;               // ISO-8601
  updated_at: string;
  ticket_id:  string | null;
  status:     CseTicketStatus;
  owner:      string | null;
  title:      string | null;
}

export interface CaseStateRecord {
  id:        string;
  dismiss:   DismissRecord   | null;
  action:    ActionRecord    | null;
  cseTicket: CseTicketRecord | null;
}

// ── Payload types ─────────────────────────────────────────────────────────────
// These types define the persistence contract.
// A future API adapter will receive the same payload shape — no translation needed.

export interface DismissPayload {
  reason?: string | null;  // dismiss reason (free text)
  actor?:  string | null;  // user who performed the action
}

export interface UndismissPayload {
  actor?: string | null;
}

export interface CreateActionPayload {
  title?:  string | null;
  owner?:  string | null;
  actor?:  string | null;  // who triggered the creation (audit)
  status?: ActionStatus;
}

export interface CreateCseTicketPayload {
  title?:  string | null;
  owner?:  string | null;
  actor?:  string | null;
  status?: CseTicketStatus;
}

// Legacy aliases — kept for backward compat with existing call sites
/** @deprecated Use CreateActionPayload */
export type ActionPayload    = CreateActionPayload;
/** @deprecated Use CreateCseTicketPayload */
export type CseTicketPayload = CreateCseTicketPayload;

// ── Adapter interface ─────────────────────────────────────────────────────────
// Persistence boundary. All UI consumers depend only on the public functions
// below — never on this interface directly.
//
// To implement an API adapter:
//   1. Create a class implementing CaseStateAdapter
//   2. Each mutation method should: call the API (optimistically), update a
//      local cache on success, throw on error (UI will handle rollback)
//   3. Replace `adapter` singleton at the bottom of this file
//   4. No UI changes required

export interface BulkResult {
  succeeded: string[];
  failed:    Array<{ id: string; error: string }>;
}

export interface CaseStateAdapter {
  // ── Sync mutations (optimistic, local cache update) ──────────────────────
  dismissCase(id: string, payload?: DismissPayload): CaseStateRecord;
  undismissCase(id: string, payload?: UndismissPayload): CaseStateRecord;
  createAction(id: string, payload?: CreateActionPayload): CaseStateRecord;
  createCseTicket(id: string, payload?: CreateCseTicketPayload): CaseStateRecord;
  bulkDismiss(ids: string[], payload?: DismissPayload): void;
  bulkCreateAction(ids: string[], payload?: CreateActionPayload): void;
  bulkCreateCseTicket(ids: string[], payload?: CreateCseTicketPayload): void;
  // ── Read ──────────────────────────────────────────────────────────────────
  getRecord(id: string): CaseStateRecord | null;
  getDismissedIds(): Set<string>;
  // ── Async load (populate cache from persistence) ──────────────────────────
  loadCaseState(id: string): Promise<CaseStateRecord | null>;
  loadCaseStates(ids: string[]): Promise<void>;
  // ── Async bulk (persistence + local cache update) ─────────────────────────
  persistBulkDismiss(ids: string[], payload?: DismissPayload): Promise<BulkResult>;
  persistBulkAction(ids: string[], payload?: CreateActionPayload): Promise<BulkResult>;
  persistBulkCseTicket(ids: string[], payload?: CreateCseTicketPayload): Promise<BulkResult>;
}

// ── Local (in-memory) implementation ─────────────────────────────────────────

class LocalCaseStateAdapter implements CaseStateAdapter {
  private store = new Map<string, CaseStateRecord>();

  private getOrCreate(id: string): CaseStateRecord {
    if (!this.store.has(id)) {
      this.store.set(id, { id, dismiss: null, action: null, cseTicket: null });
    }
    return this.store.get(id)!;
  }

  dismissCase(id: string, payload?: DismissPayload): CaseStateRecord {
    const rec = this.getOrCreate(id);
    const now = new Date().toISOString();
    rec.dismiss = {
      active:           true,
      dismissed_at:     now,
      dismissed_by:     payload?.actor  ?? null,
      dismissed_reason: payload?.reason ?? null,
      undismissed_at:   null,
      undismissed_by:   null,
    };
    return rec;
  }

  undismissCase(id: string, payload?: UndismissPayload): CaseStateRecord {
    const rec = this.getOrCreate(id);
    if (rec.dismiss) {
      rec.dismiss = {
        ...rec.dismiss,
        active:         false,
        undismissed_at: new Date().toISOString(),
        undismissed_by: payload?.actor ?? null,
      };
    }
    return rec;
  }

  createAction(id: string, payload?: CreateActionPayload): CaseStateRecord {
    const rec = this.getOrCreate(id);
    const now = new Date().toISOString();
    rec.action = {
      created_at: now,
      updated_at: now,
      action_id:  null,
      status:     payload?.status ?? "open",
      owner:      payload?.owner  ?? null,
      title:      payload?.title  ?? null,
    };
    return rec;
  }

  createCseTicket(id: string, payload?: CreateCseTicketPayload): CaseStateRecord {
    const rec = this.getOrCreate(id);
    const now = new Date().toISOString();
    rec.cseTicket = {
      created_at: now,
      updated_at: now,
      ticket_id:  null,
      status:     payload?.status ?? "open",
      owner:      payload?.owner  ?? null,
      title:      payload?.title  ?? null,
    };
    return rec;
  }

  bulkDismiss(ids: string[], payload?: DismissPayload): void {
    for (const id of ids) this.dismissCase(id, payload);
  }

  bulkCreateAction(ids: string[], payload?: CreateActionPayload): void {
    for (const id of ids) this.createAction(id, payload);
  }

  bulkCreateCseTicket(ids: string[], payload?: CreateCseTicketPayload): void {
    for (const id of ids) this.createCseTicket(id, payload);
  }

  getRecord(id: string): CaseStateRecord | null {
    return this.store.get(id) ?? null;
  }

  getDismissedIds(): Set<string> {
    const s = new Set<string>();
    for (const [k, v] of this.store) {
      if (v.dismiss?.active) s.add(k);
    }
    return s;
  }

  // Local adapter: no persistence — load is a no-op
  async loadCaseState(_id: string): Promise<CaseStateRecord | null> { return null; }
  async loadCaseStates(_ids: string[]): Promise<void> { /* no-op */ }

  async persistBulkDismiss(ids: string[], payload?: DismissPayload): Promise<BulkResult> {
    this.bulkDismiss(ids, payload);
    return { succeeded: ids, failed: [] };
  }
  async persistBulkAction(ids: string[], payload?: CreateActionPayload): Promise<BulkResult> {
    this.bulkCreateAction(ids, payload);
    return { succeeded: ids, failed: [] };
  }
  async persistBulkCseTicket(ids: string[], payload?: CreateCseTicketPayload): Promise<BulkResult> {
    this.bulkCreateCseTicket(ids, payload);
    return { succeeded: ids, failed: [] };
  }
}

// ── API-backed implementation ─────────────────────────────────────────────────
// Persists mutations via API routes. Keeps a local in-memory cache for reads
// so components never block on network for already-loaded state.

class ApiCaseStateAdapter implements CaseStateAdapter {
  // Local mirror — populated by loadCaseState / loadCaseStates
  private cache = new LocalCaseStateAdapter();

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async apiFetch(path: string, options?: RequestInit): Promise<CaseStateRecord | null> {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
    const json: { state: CaseStateRecord | null } = await res.json();
    return json.state ?? null;
  }

  private applyToCache(record: CaseStateRecord | null): void {
    if (!record) return;
    // Replay the record into the local cache so reads reflect persisted state
    if (record.dismiss?.active) {
      this.cache.dismissCase(record.id, {
        actor:  record.dismiss.dismissed_by,
        reason: record.dismiss.dismissed_reason,
      });
    } else if (record.dismiss && !record.dismiss.active) {
      // dismissed then undismissed — apply dismiss first, then undo
      this.cache.dismissCase(record.id);
      this.cache.undismissCase(record.id);
    }
    if (record.action) {
      this.cache.createAction(record.id, {
        status: record.action.status,
        owner:  record.action.owner,
        title:  record.action.title,
      });
    }
    if (record.cseTicket) {
      this.cache.createCseTicket(record.id, {
        status: record.cseTicket.status,
        owner:  record.cseTicket.owner,
        title:  record.cseTicket.title,
      });
    }
  }

  // ── Async load ─────────────────────────────────────────────────────────────

  async loadCaseState(id: string): Promise<CaseStateRecord | null> {
    const record = await this.apiFetch(`/api/support/cases/${id}/state`);
    this.applyToCache(record);
    return record;
  }

  async loadCaseStates(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    // Fetch individually in parallel (bulk GET endpoint can be added later)
    await Promise.all(ids.map(id => this.loadCaseState(id).catch(() => null)));
  }

  // ── Sync mutations (optimistic local + async persist) ─────────────────────

  dismissCase(id: string, payload?: DismissPayload): CaseStateRecord {
    const rec = this.cache.dismissCase(id, payload);
    // fire-and-forget persist
    this.apiFetch(`/api/support/cases/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ reason: payload?.reason, actor: payload?.actor }),
    }).catch(err => console.error('[ApiAdapter] dismissCase persist failed', err));
    return rec;
  }

  undismissCase(id: string, payload?: UndismissPayload): CaseStateRecord {
    const rec = this.cache.undismissCase(id, payload);
    this.apiFetch(`/api/support/cases/${id}/dismiss`, {
      method: 'DELETE',
      body: JSON.stringify({ actor: payload?.actor }),
    }).catch(err => console.error('[ApiAdapter] undismissCase persist failed', err));
    return rec;
  }

  createAction(id: string, payload?: CreateActionPayload): CaseStateRecord {
    const rec = this.cache.createAction(id, payload);
    this.apiFetch(`/api/support/cases/${id}/action`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }).catch(err => console.error('[ApiAdapter] createAction persist failed', err));
    return rec;
  }

  createCseTicket(id: string, payload?: CreateCseTicketPayload): CaseStateRecord {
    const rec = this.cache.createCseTicket(id, payload);
    this.apiFetch(`/api/support/cases/${id}/cse-ticket`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }).catch(err => console.error('[ApiAdapter] createCseTicket persist failed', err));
    return rec;
  }

  bulkDismiss(ids: string[], payload?: DismissPayload): void {
    this.cache.bulkDismiss(ids, payload);
  }
  bulkCreateAction(ids: string[], payload?: CreateActionPayload): void {
    this.cache.bulkCreateAction(ids, payload);
  }
  bulkCreateCseTicket(ids: string[], payload?: CreateCseTicketPayload): void {
    this.cache.bulkCreateCseTicket(ids, payload);
  }

  getRecord(id: string): CaseStateRecord | null { return this.cache.getRecord(id); }
  getDismissedIds(): Set<string>                { return this.cache.getDismissedIds(); }

  // ── Async bulk (persist + local) ──────────────────────────────────────────

  async persistBulkDismiss(ids: string[], payload?: DismissPayload): Promise<BulkResult> {
    this.cache.bulkDismiss(ids, payload);
    return this.bulkApi('dismiss', ids, payload);
  }

  async persistBulkAction(ids: string[], payload?: CreateActionPayload): Promise<BulkResult> {
    this.cache.bulkCreateAction(ids, payload);
    return this.bulkApi('action', ids, payload);
  }

  async persistBulkCseTicket(ids: string[], payload?: CreateCseTicketPayload): Promise<BulkResult> {
    this.cache.bulkCreateCseTicket(ids, payload);
    return this.bulkApi('cse-ticket', ids, payload);
  }

  private async bulkApi(
    op: string,
    ids: string[],
    payload?: object,
  ): Promise<BulkResult> {
    const res = await fetch('/api/support/cases/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, ids, payload: payload ?? {} }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { succeeded: [], failed: ids.map(id => ({ id, error: text || res.statusText })) };
    }
    return res.json() as Promise<BulkResult>;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────
// To switch to a persistent backend: replace `new LocalCaseStateAdapter()` with
// `new ApiCaseStateAdapter()`.
// All UI code reads from useCaseState() and will pick up the change automatically.

const adapter: CaseStateAdapter = new ApiCaseStateAdapter();

// ── Subscriber pattern ────────────────────────────────────────────────────────

const LISTENERS = new Set<() => void>();

function notify() {
  LISTENERS.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
}

// ── Public mutation functions ─────────────────────────────────────────────────
// These are the only mutation entry points for UI components.
// Each calls notify() after mutation so all useCaseState() subscribers re-render.
// Replace adapter singleton to make these persistent — signature stays the same.

export function dismissCase(id: string, payload?: DismissPayload): CaseStateRecord {
  const rec = adapter.dismissCase(id, payload);
  notify();
  return rec;
}

export function undismissCase(id: string, payload?: UndismissPayload): CaseStateRecord {
  const rec = adapter.undismissCase(id, payload);
  notify();
  return rec;
}

export function createAction(id: string, payload?: ActionPayload): CaseStateRecord {
  const rec = adapter.createAction(id, payload);
  notify();
  return rec;
}

export function createCseTicket(id: string, payload?: CseTicketPayload): CaseStateRecord {
  const rec = adapter.createCseTicket(id, payload);
  notify();
  return rec;
}

export function bulkDismiss(ids: string[], payload?: DismissPayload): void {
  adapter.bulkDismiss(ids, payload);
  notify();
}

export function bulkCreateAction(ids: string[], payload?: CreateActionPayload): void {
  adapter.bulkCreateAction(ids, payload);
  notify();
}

export function bulkCreateCseTicket(ids: string[], payload?: CreateCseTicketPayload): void {
  adapter.bulkCreateCseTicket(ids, payload);
  notify();
}

// ── Public async load functions ───────────────────────────────────────────────
// Load state from persistence into the local cache, then notify subscribers.

export async function loadCaseState(id: string): Promise<CaseStateRecord | null> {
  const rec = await adapter.loadCaseState(id);
  notify();
  return rec;
}

export async function loadCaseStates(ids: string[]): Promise<void> {
  await adapter.loadCaseStates(ids);
  notify();
}

// ── Public async bulk functions ───────────────────────────────────────────────
// Persist bulk mutations, notify subscribers, and return partial-failure info.

export async function persistBulkDismiss(ids: string[], payload?: DismissPayload): Promise<BulkResult> {
  const result = await adapter.persistBulkDismiss(ids, payload);
  notify();
  return result;
}

export async function persistBulkAction(ids: string[], payload?: CreateActionPayload): Promise<BulkResult> {
  const result = await adapter.persistBulkAction(ids, payload);
  notify();
  return result;
}

export async function persistBulkCseTicket(ids: string[], payload?: CreateCseTicketPayload): Promise<BulkResult> {
  const result = await adapter.persistBulkCseTicket(ids, payload);
  notify();
  return result;
}

// ── Public read functions ──────────────────────────────────────────────────────

export function getCaseRecord(id: string): CaseStateRecord | null {
  return adapter.getRecord(id);
}

export function isDismissed(id: string): boolean {
  return adapter.getRecord(id)?.dismiss?.active === true;
}

export function getDismissedIds(): Set<string> {
  return adapter.getDismissedIds();
}

// ── React hook ────────────────────────────────────────────────────────────────
// Subscribes to global case mutations and triggers re-renders on change.

export function useCaseState() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return subscribe(() => forceUpdate(n => n + 1));
  }, []);

  const loadState = useCallback(
    (id: string) => loadCaseState(id),
    [],
  );

  const loadStates = useCallback(
    (ids: string[]) => loadCaseStates(ids),
    [],
  );

  return {
    isDismissed,
    dismissCase,
    undismissCase,
    createAction,
    createCseTicket,
    bulkDismiss,
    bulkCreateAction,
    bulkCreateCseTicket,
    persistBulkDismiss,
    persistBulkAction,
    persistBulkCseTicket,
    getCaseRecord,
    getDismissedIds,
    loadCaseState: loadState,
    loadCaseStates: loadStates,
  };
}
