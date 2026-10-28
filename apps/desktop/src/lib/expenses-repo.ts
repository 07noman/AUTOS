import { supabase, isSupabaseConfigured } from './supabase';
import { safeUUID } from './uuid';
import { getCurrentTenantId } from './db';

export interface Expense {
  id: string;
  store_id: string;
  business_id?: string | null;
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  payment_method: string;
  description?: string | null;
  added_by?: string | null;
  created_at?: string;
}

export function getCurrentStoreId(): string {
  if (typeof window === 'undefined') return 'default_store';
  try {
    const directStore = localStorage.getItem('store_id');
    if (directStore && directStore.trim()) return directStore.trim();

    const genxStore = localStorage.getItem('genx:store_id');
    if (genxStore && genxStore.trim()) return genxStore.trim();

    const tenant = getCurrentTenantId();
    if (tenant && tenant.trim()) return tenant.trim();
  } catch {}
  return 'default_store';
}

export const expenseRepo = {
  /**
   * Retrieves all expenses strictly filtered by store_id.
   * Reads from Supabase Cloud PostgreSQL and falls back / caches in localStorage.
   */
  async findAll(storeId = getCurrentStoreId()): Promise<Expense[]> {
    if (!storeId) return [];

    let remoteExpenses: Expense[] | null = null;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*')
          .eq('store_id', storeId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          remoteExpenses = data.map((row: any) => ({
            id: String(row.id),
            store_id: String(row.store_id),
            business_id: row.business_id ? String(row.business_id) : null,
            date: String(row.date),
            category: String(row.category || 'Other'),
            amount: Number(row.amount) || 0,
            payment_method: String(row.payment_method || 'Cash'),
            description: row.description || '',
            added_by: row.added_by || '',
            created_at: row.created_at || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn('[expenseRepo] Supabase findAll error:', err);
      }
    }

    if (remoteExpenses !== null) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`genx:expenses_cache:${storeId}`, JSON.stringify(remoteExpenses.slice(0, 500)));
        }
      } catch {}
      return remoteExpenses;
    }

    // Fallback to local cache if offline or error
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(`genx:expenses_cache:${storeId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.filter((e: Expense) => e.store_id === storeId);
          }
        }
      }
    } catch {}

    return [];
  },

  /**
   * Insert a new expense record into Supabase and local cache.
   */
  async create(input: {
    id?: string;
    store_id?: string;
    business_id?: string | null;
    date: string;
    category: string;
    amount: number;
    payment_method?: string;
    description?: string | null;
    added_by?: string | null;
  }): Promise<Expense> {
    const store_id = input.store_id || getCurrentStoreId();
    const id = input.id || safeUUID();
    const newExpense: Expense = {
      id,
      store_id,
      business_id: input.business_id || null,
      date: input.date || new Date().toISOString().split('T')[0],
      category: input.category || 'Other',
      amount: Number(input.amount) || 0,
      payment_method: input.payment_method || 'Cash',
      description: input.description || '',
      added_by: input.added_by || '',
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('expenses').insert({
          id: newExpense.id,
          store_id: newExpense.store_id,
          business_id: newExpense.business_id,
          date: newExpense.date,
          category: newExpense.category,
          amount: newExpense.amount,
          payment_method: newExpense.payment_method,
          description: newExpense.description,
          added_by: newExpense.added_by,
        });
        if (error) {
          console.warn('[expenseRepo] Supabase insert warning:', error.message);
        }
      } catch (err) {
        console.warn('[expenseRepo] Supabase insert error:', err);
      }
    }

    // Update local cache
    try {
      if (typeof window !== 'undefined') {
        const cacheKey = `genx:expenses_cache:${store_id}`;
        const raw = localStorage.getItem(cacheKey);
        const existing: Expense[] = raw ? JSON.parse(raw) : [];
        const next = [newExpense, ...existing.filter((e) => e.id !== newExpense.id)];
        localStorage.setItem(cacheKey, JSON.stringify(next.slice(0, 500)));
      }
    } catch {}

    return newExpense;
  },

  /**
   * Deletes an expense by ID from Supabase and local cache.
   */
  async delete(id: string, storeId = getCurrentStoreId()): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('expenses').delete().eq('id', id);
      } catch (err) {
        console.warn('[expenseRepo] Supabase delete error:', err);
      }
    }

    try {
      if (typeof window !== 'undefined') {
        const cacheKey = `genx:expenses_cache:${storeId}`;
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const existing: Expense[] = JSON.parse(raw);
          const next = existing.filter((e) => e.id !== id);
          localStorage.setItem(cacheKey, JSON.stringify(next));
        }
      }
    } catch {}
  },
};
