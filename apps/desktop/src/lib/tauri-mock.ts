// Browser mock for Tauri SQL plugin when running outside Tauri desktop shell (e.g. vite dev in browser or vitest)

export function setupTauriBrowserMock(): void {
  if (typeof window === 'undefined') return;

  const w = window as any;
  if (w.__TAURI_INTERNALS__ || w.__TAURI__) return;

  const getStorage = <T>(key: string, fallback: T): T => {
    try {
      const data = localStorage.getItem(`genx_sql_${key}`);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  };

  const setStorage = <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(`genx_sql_${key}`, JSON.stringify(value));
    } catch {
      // ignore
    }
  };

  w.__TAURI_INTERNALS__ = {
    invoke: async (cmd: string, args: Record<string, any> = {}) => {
      if (cmd === 'plugin:sql|load') {
        return args.db || 'sqlite:genx.db';
      }

      if (cmd === 'plugin:sql|close') {
        return true;
      }

      if (cmd === 'plugin:sql|execute') {
        const query: string = (args.query || '').trim();
        const values: any[] = args.values || [];

        if (
          query.startsWith('CREATE') ||
          query.startsWith('BEGIN') ||
          query.startsWith('COMMIT') ||
          query.startsWith('ROLLBACK') ||
          query.startsWith('ALTER')
        ) {
          return [0, 0];
        }

        // ── schema_migrations INSERT ───────────────────────────────────────
        if (query.startsWith('INSERT INTO schema_migrations')) {
          const migrations = getStorage<any[]>('schema_migrations', []);
          const [version, name, applied_at] = values;
          migrations.push({ version, name, applied_at });
          setStorage('schema_migrations', migrations);
          return [1, 1];
        }

        // ── app_metadata INSERT / UPDATE ───────────────────────────────────
        if (query.startsWith('INSERT INTO app_metadata')) {
          const metadata = getStorage<any[]>('app_metadata', []);
          const [key, value, created_at, updated_at] = values;
          const idx = metadata.findIndex((m) => m.key === key);
          if (idx >= 0) {
            metadata[idx] = { key, value, created_at: metadata[idx].created_at, updated_at };
          } else {
            metadata.push({ key, value, created_at, updated_at });
          }
          setStorage('app_metadata', metadata);
          return [1, 1];
        }

        // ── sync_state INSERT / UPDATE ─────────────────────────────────────
        if (query.startsWith('INSERT INTO sync_state')) {
          const syncState = getStorage<any[]>('sync_state', []);
          const [id, tenant_id, device_id, scope, cursor, updated_at] = values;
          const idx = syncState.findIndex(
            (s) => s.tenant_id === tenant_id && s.device_id === device_id && s.scope === scope
          );
          if (idx >= 0) {
            syncState[idx] = { ...syncState[idx], cursor, updated_at };
          } else {
            syncState.push({ id, tenant_id, device_id, scope, cursor, updated_at });
          }
          setStorage('sync_state', syncState);
          return [1, 1];
        }

        if (query.startsWith('UPDATE sync_state SET cursor = ?')) {
          const [cursor, updated_at, tenant_id, device_id, scope] = values;
          const syncState = getStorage<any[]>('sync_state', []);
          const item = syncState.find(
            (s) => s.tenant_id === tenant_id && s.device_id === device_id && s.scope === scope
          );
          if (item) {
            item.cursor = cursor;
            item.updated_at = updated_at;
            setStorage('sync_state', syncState);
          }
          return [1, 1];
        }

        // ── stock_movements INSERT ─────────────────────────────────────────
        if (query.startsWith('INSERT INTO stock_movements')) {
          const movements = getStorage<any[]>('stock_movements', []);
          const [
            id, tenant_id, product_id, quantity_delta, movement_type,
            reference_type, reference_id, device_id, notes, created_at
          ] = values;

          // In the real SQLite schema, there is no UNIQUE constraint on reference_id/product_id
          // so we shouldn't throw an error here.

          movements.push({
            id, tenant_id, product_id, quantity_delta, movement_type,
            reference_type, reference_id, device_id, notes, created_at,
          });
          setStorage('stock_movements', movements);
          return [1, 1];
        }

        if (query.startsWith('INSERT INTO products')) {
          const products = getStorage<any[]>('products', []);
          const [
            id, tenant_id, sku, name, description, barcode,
            category_id, cost_price, selling_price, wholesale_price,
            stock, minimum_stock, status, images, metadata, created_at, updated_at
          ] = values;

          const existingIdx = products.findIndex((p) => p.id === id);
          const item = {
            id, tenant_id, sku, name, description, barcode,
            category_id, cost_price, selling_price, wholesale_price,
            stock, minimum_stock, status, images, metadata,
            created_at: created_at || Date.now(),
            updated_at: updated_at || Date.now(),
            deleted_at: null,
          };

          if (existingIdx >= 0) {
            products[existingIdx] = item;
          } else {
            products.push(item);
          }
          setStorage('products', products);
          return [1, 1];
        }

        if (query.startsWith('UPDATE products SET stock = stock + ?')) {
          const [delta, updated_at, productId, tenantId] = values;
          const products = getStorage<any[]>('products', []);
          const prod = products.find((p) => p.id === productId && p.tenant_id === tenantId);
          if (prod) {
            prod.stock = (prod.stock || 0) + delta;
            prod.updated_at = updated_at || Date.now();
            setStorage('products', products);
          }
          return [1, 1];
        }

        if (query.startsWith('UPDATE products SET stock = stock - ?')) {
          const [delta, updated_at, productId, tenantId] = values;
          const products = getStorage<any[]>('products', []);
          const prod = products.find((p) => p.id === productId && p.tenant_id === tenantId);
          if (prod) {
            prod.stock = (prod.stock || 0) - delta;
            prod.updated_at = updated_at || Date.now();
            setStorage('products', products);
          }
          return [1, 1];
        }

        if (query.startsWith('UPDATE products SET deleted_at = ?')) {
          const [deleted_at, updated_at, id, tenantId] = values;
          const products = getStorage<any[]>('products', []);
          const prod = products.find((p) => p.id === id && p.tenant_id === tenantId);
          if (prod) {
            prod.deleted_at = deleted_at;
            prod.updated_at = updated_at;
            setStorage('products', products);
          }
          return [1, 1];
        }

        if (query.startsWith('UPDATE products SET')) {
          const products = getStorage<any[]>('products', []);
          const [
            sku, name, description, barcode, category_id,
            cost_price, selling_price, wholesale_price,
            stock, minimum_stock, status, images, metadata, updated_at,
            id, tenantId
          ] = values;
          const prod = products.find((p) => p.id === id && p.tenant_id === tenantId);
          if (prod) {
            Object.assign(prod, {
              sku, name, description, barcode, category_id,
              cost_price, selling_price, wholesale_price,
              stock, minimum_stock, status, images, metadata,
              updated_at: updated_at || Date.now(),
            });
            setStorage('products', products);
          }
          return [1, 1];
        }

        if (query.startsWith('INSERT INTO orders')) {
          const orders = getStorage<any[]>('orders', []);
          const [
            id, tenant_id, order_number, customer_id, subtotal,
            discount, tax, total, payment_method, status, notes,
            created_at, updated_at
          ] = values;
          orders.push({
            id, tenant_id, order_number, customer_id, subtotal,
            discount, tax, total, payment_method, status, notes,
            created_at, updated_at,
          });
          setStorage('orders', orders);
          return [1, 1];
        }

        if (query.startsWith('INSERT INTO order_items')) {
          const orderItems = getStorage<any[]>('order_items', []);
          const [id, order_id, product_id, name, sku, quantity, price, discount, tax, total, created_at] = values;
          orderItems.push({
            id, order_id, product_id, name, sku, quantity, price, discount, tax, total, created_at,
          });
          setStorage('order_items', orderItems);
          return [1, 1];
        }

        if (query.startsWith('INSERT INTO outbox')) {
          const outbox = getStorage<any[]>('outbox', []);
          let entry: any = {};
          if (values.length === 12) {
            // Full upgraded schema
            const [
              id, tenant_id, entity_type, entity_id, operation, payload,
              status, device_id, idempotency_key, version, sequence_number, created_at
            ] = values;
            entry = {
              id, tenant_id, entity_type, entity_id, operation, payload,
              status: status || 'pending',
              device_id, idempotency_key, version, sequence_number,
              attempts: 0, last_attempt_at: null, synced_at: null, error: null,
              created_at: created_at || Date.now(),
            };
          } else if (values.length === 10) {
            // Atomic sale outbox with device_id, idempotency_key, version
            const [
              id, tenant_id, entity_type, entity_id, operation, payload,
              status, device_id, idempotency_key, created_at
            ] = values;
            entry = {
              id, tenant_id, entity_type, entity_id, operation, payload,
              status: status || 'pending',
              device_id, idempotency_key, version: 1, sequence_number: null,
              attempts: 0, last_attempt_at: null, synced_at: null, error: null,
              created_at: created_at || Date.now(),
            };
          } else if (values.length === 9) {
            // INSERT INTO outbox (..., status, device_id, idempotency_key, version, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, 1, ?)
            const [
              id, tenant_id, entity_type, entity_id, operation, payload,
              device_id, idempotency_key, created_at
            ] = values;
            entry = {
              id, tenant_id, entity_type, entity_id, operation, payload,
              status: 'pending',
              device_id, idempotency_key, version: 1, sequence_number: null,
              attempts: 0, last_attempt_at: null, synced_at: null, error: null,
              created_at: created_at || Date.now(),
            };
          } else if (values.length === 7) {
            const [id, tenant_id, entity_type, entity_id, operation, payload, created_at] = values;
            entry = {
              id, tenant_id, entity_type, entity_id, operation, payload,
              status: 'pending',
              attempts: 0, last_attempt_at: null, synced_at: null, error: null,
              created_at: created_at || Date.now(),
            };
          } else {
            const [id, tenant_id, entity_type, entity_id, operation, payload, status, created_at] = values;
            entry = {
              id, tenant_id, entity_type, entity_id, operation, payload,
              status: status || 'pending',
              attempts: 0, last_attempt_at: null, synced_at: null, error: null,
              created_at: created_at || Date.now(),
            };
          }

          outbox.push(entry);
          setStorage('outbox', outbox);
          return [1, 1];
        }

        if (query.startsWith("UPDATE outbox SET status = 'synced'")) {
          const [synced_at, id] = values;
          const outbox = getStorage<any[]>('outbox', []);
          const item = outbox.find((o) => o.id === id);
          if (item) {
            item.status = 'synced';
            item.synced_at = synced_at;
            setStorage('outbox', outbox);
          }
          return [1, 1];
        }

        if (query.startsWith("UPDATE outbox SET status = 'failed'")) {
          const [error, last_attempt_at, id] = values;
          const outbox = getStorage<any[]>('outbox', []);
          const item = outbox.find((o) => o.id === id);
          if (item) {
            item.status = 'failed';
            item.error = error;
            item.attempts = (item.attempts || 0) + 1;
            item.last_attempt_at = last_attempt_at;
            setStorage('outbox', outbox);
          }
          return [1, 1];
        }

        // ── pos_orders INSERT ──────────────────────────────────────────────
        if (query.startsWith('INSERT INTO pos_orders')) {
          const pos_orders = getStorage<any[]>('pos_orders', []);
          let rec: any;
          if (query.includes('vehicle_plate_number')) {
            const [
              id, tenant_id, order_number, status, customer_name, customer_id,
              vehicle_plate_number, vehicle_make_model, vehicle_mileage,
              payment_method, subtotal, tax, total, paid_amount, items, notes,
              created_at, updated_at
            ] = values;
            rec = {
              id, tenant_id, order_number, status, customer_name, customer_id,
              vehicle_plate_number, vehicle_make_model, vehicle_mileage,
              payment_method, subtotal, tax, total, paid_amount,
              items: typeof items === 'string' ? items : JSON.stringify(items),
              notes, created_at, updated_at,
            };
          } else {
            const [
              id, tenant_id, order_number, status, customer_name, customer_id,
              payment_method, subtotal, tax, total, paid_amount, items, notes,
              created_at, updated_at
            ] = values;
            rec = {
              id, tenant_id, order_number, status, customer_name, customer_id,
              payment_method, subtotal, tax, total, paid_amount,
              items: typeof items === 'string' ? items : JSON.stringify(items),
              notes, created_at, updated_at,
            };
          }
          pos_orders.push(rec);
          setStorage('pos_orders', pos_orders);
          return [1, 1];
        }

        // ── pos_orders UPDATE (PAID / CANCELLED) ──────────────────────────
        if (query.startsWith('UPDATE pos_orders SET status=')) {
          const pos_orders = getStorage<any[]>('pos_orders', []);
          if (query.includes('payment_method=?')) {
            const [
              payment_method, paid_amount, subtotal, tax, total,
              items, customer_name, customer_id, updated_at, id, tenant_id
            ] = values;
            const idx = pos_orders.findIndex((o) => o.id === id && o.tenant_id === tenant_id);
            if (idx >= 0) {
              pos_orders[idx] = {
                ...pos_orders[idx],
                status: 'PAID', payment_method, paid_amount,
                subtotal, tax, total,
                items: typeof items === 'string' ? items : JSON.stringify(items),
                customer_name, customer_id, updated_at,
              };
              setStorage('pos_orders', pos_orders);
            }
          } else {
            const [updated_at, id, tenant_id] = values;
            const idx = pos_orders.findIndex((o) => o.id === id && o.tenant_id === tenant_id);
            if (idx >= 0) {
              pos_orders[idx] = { ...pos_orders[idx], status: 'CANCELLED', updated_at };
              setStorage('pos_orders', pos_orders);
            }
          }
          return [1, 1];
        }

        // ── pos_orders DELETE ──────────────────────────────────────────────
        if (query.startsWith('DELETE FROM pos_orders')) {
          const pos_orders = getStorage<any[]>('pos_orders', []);
          let filtered: any[];
          if (!query.includes('WHERE')) {
            filtered = [];
          } else if (query.includes('WHERE tenant_id = ?') && values.length === 1) {
            filtered = pos_orders.filter((o) => o.tenant_id !== values[0]);
          } else if (query.includes('WHERE id = ? AND tenant_id = ?')) {
            const [id, tenant_id] = values;
            filtered = pos_orders.filter((o) => !(o.id === id && o.tenant_id === tenant_id));
          } else if (query.includes('WHERE id = ?')) {
            const [id] = values;
            filtered = pos_orders.filter((o) => o.id !== id);
          } else {
            const [id, tenant_id] = values;
            filtered = pos_orders.filter((o) => !(o.id === id && (!tenant_id || o.tenant_id === tenant_id)));
          }
          setStorage('pos_orders', filtered);
          return [1, 1];
        }

        // ── orders DELETE ──────────────────────────────────────────────────
        if (query.startsWith('DELETE FROM orders')) {
          const orders = getStorage<any[]>('orders', []);
          let filtered: any[];
          if (!query.includes('WHERE')) {
            filtered = [];
          } else if (query.includes('WHERE tenant_id = ?')) {
            filtered = orders.filter((o) => o.tenant_id !== values[0]);
          } else if (query.includes('WHERE id = ?')) {
            filtered = orders.filter((o) => o.id !== values[0]);
          } else {
            filtered = [];
          }
          setStorage('orders', filtered);
          return [1, 1];
        }

        // ── vehicles INSERT / UPDATE ───────────────────────────────────────
        if (query.startsWith('INSERT INTO vehicles')) {
          const vehicles = getStorage<any[]>('vehicles', []);
          const [
            id, tenant_id, customer_id, customer_name, make, model, year, license_plate,
            vin, color, mileage, notes, created_at, updated_at
          ] = values;
          const cleanPlate = String(license_plate || '').trim().toUpperCase();
          const existingIdx = vehicles.findIndex(
            (v) =>
              (cleanPlate && String(v.license_plate || '').trim().toUpperCase() === cleanPlate && (!tenant_id || v.tenant_id === tenant_id)) ||
              (id && v.id === id)
          );
          const item = {
            id: id || crypto.randomUUID(),
            tenant_id,
            customer_id: customer_id || null,
            customer_name: customer_name || null,
            make: make || '',
            model: model || '',
            year: Number(year) || 2024,
            license_plate: license_plate || '',
            vin: vin || null,
            color: color || null,
            mileage: mileage ? Number(mileage) : null,
            notes: notes || null,
            created_at: created_at || Date.now(),
            updated_at: updated_at || Date.now(),
          };
          if (existingIdx >= 0) {
            vehicles[existingIdx] = {
              ...vehicles[existingIdx],
              ...item,
              id: vehicles[existingIdx].id || item.id,
              created_at: vehicles[existingIdx].created_at || item.created_at,
              updated_at: Date.now(),
            };
          } else {
            vehicles.push(item);
          }
          setStorage('vehicles', vehicles);
          return [1, 1];
        }

        // ── vehicles UPDATE ────────────────────────────────────────────────
        if (query.startsWith('UPDATE vehicles SET')) {
          const vehicles = getStorage<any[]>('vehicles', []);
          const id = values[values.length - 2];
          const tenant_id = values[values.length - 1];
          const idx = vehicles.findIndex((v) => v.id === id && (!tenant_id || v.tenant_id === tenant_id));
          if (idx >= 0) {
            vehicles[idx] = { ...vehicles[idx], updated_at: Date.now() };
            setStorage('vehicles', vehicles);
          }
          return [1, 1];
        }

        // ── customers INSERT ──────────────────────────────────────────────
        if (query.startsWith('INSERT INTO customers')) {
          const customers = getStorage<any[]>('customers', []);
          const [
            id, tenant_id, name, phone, email, address, balance, credit_limit,
            created_at, updated_at
          ] = values;
          const existingIdx = customers.findIndex((c) => c.id === id);
          const item = {
            id, tenant_id, name, phone, email, address,
            balance: Number(balance || 0), credit_limit: Number(credit_limit || 0),
            created_at: created_at || Date.now(), updated_at: updated_at || Date.now(),
          };
          if (existingIdx >= 0) {
            customers[existingIdx] = item;
          } else {
            customers.push(item);
          }
          setStorage('customers', customers);
          return [1, 1];
        }

        // ── customers UPDATE balance ──────────────────────────────────────
        if (query.startsWith('UPDATE customers SET balance = balance + ?')) {
          const [delta, updated_at, id, tenantId] = values;
          const customers = getStorage<any[]>('customers', []);
          const cust = customers.find((c) => c.id === id && c.tenant_id === tenantId);
          if (cust) {
            cust.balance = (Number(cust.balance) || 0) + Number(delta);
            cust.updated_at = updated_at || Date.now();
            setStorage('customers', customers);
          }
          return [1, 1];
        }

        // ── auto_care_invoices INSERT ──────────────────────────────────────
        if (query.startsWith('INSERT INTO auto_care_invoices')) {
          const invoices = getStorage<any[]>('auto_care_invoices', []);
          const [
            id, tenant_id, invoice_number, job_id, job_number, customer_id, customer_name,
            vehicle_summary, items, subtotal, discount, tax, total, payment_method,
            status, notes, created_at, updated_at
          ] = values;
          invoices.push({
            id, tenant_id, invoice_number, job_id, job_number, customer_id, customer_name,
            vehicle_summary,
            items: typeof items === 'string' ? items : JSON.stringify(items),
            subtotal, discount, tax, total, payment_method, status, notes,
            created_at, updated_at
          });
          setStorage('auto_care_invoices', invoices);
          return [1, 1];
        }

        // ── categories INSERT ──────────────────────────────────────
        if (query.startsWith('INSERT INTO categories')) {
          const categories = getStorage<any[]>('categories', []);
          const [id, tenant_id, name, parent_id, created_at, updated_at] = values;
          const existingIdx = categories.findIndex((c) => c.id === id);
          const item = {
            id,
            tenant_id,
            name,
            parent_id: parent_id || null,
            created_at: created_at || Date.now(),
            updated_at: updated_at || Date.now(),
          };
          if (existingIdx >= 0) {
            categories[existingIdx] = item;
          } else {
            categories.push(item);
          }
          setStorage('categories', categories);
          return [1, 1];
        }

        // ── categories UPDATE ──────────────────────────────────────
        if (query.startsWith('UPDATE categories')) {
          const [name, parent_id, updated_at, id, tenantId] = values;
          const categories = getStorage<any[]>('categories', []);
          const cat = categories.find((c) => c.id === id && c.tenant_id === tenantId);
          if (cat) {
            if (name) cat.name = name;
            cat.parent_id = parent_id || null;
            cat.updated_at = updated_at || Date.now();
            setStorage('categories', categories);
          }
          return [1, 1];
        }

        // ── categories DELETE ──────────────────────────────────────
        if (query.startsWith('DELETE FROM categories')) {
          const [id, tenantId] = values;
          let categories = getStorage<any[]>('categories', []);
          categories = categories.filter((c) => !(c.id === id && c.tenant_id === tenantId));
          setStorage('categories', categories);
          return [1, 1];
        }

        return [0, 0];
      }

      if (cmd === 'plugin:sql|select') {
        const query: string = (args.query || '').trim();
        const values: any[] = args.values || [];

        // ── schema_migrations SELECT ───────────────────────────────────────
        if (query.includes('FROM schema_migrations')) {
          const migrations = getStorage<any[]>('schema_migrations', []);
          return migrations.sort((a, b) => a.version - b.version);
        }

        // ── app_metadata SELECT ───────────────────────────────────────────
        if (query.includes('FROM app_metadata')) {
          const metadata = getStorage<any[]>('app_metadata', []);
          if (query.includes('WHERE key = ?')) {
            const key = values[0];
            const item = metadata.find((m) => m.key === key);
            return item ? [item] : [];
          }
          return metadata;
        }

        // ── sync_state SELECT ─────────────────────────────────────────────
        if (query.includes('FROM sync_state')) {
          const syncState = getStorage<any[]>('sync_state', []);
          if (query.includes('WHERE tenant_id = ? AND device_id = ? AND scope = ?')) {
            const [tenantId, deviceId, scope] = values;
            const item = syncState.find(
              (s) => s.tenant_id === tenantId && s.device_id === deviceId && s.scope === scope
            );
            return item ? [item] : [];
          }
          const tenantId = values[0];
          return syncState.filter((s) => !tenantId || s.tenant_id === tenantId);
        }

        // ── stock_movements SELECT ─────────────────────────────────────────
        if (query.includes('FROM stock_movements')) {
          const movements = getStorage<any[]>('stock_movements', []);
          if (query.includes('COALESCE(SUM(quantity_delta), 0)')) {
            const [tenantId, productId] = values;
            const filtered = movements.filter(
              (m) => m.tenant_id === tenantId && m.product_id === productId
            );
            const total = filtered.reduce((s, m) => s + Number(m.quantity_delta), 0);
            return [{ total }];
          }

          if (query.includes('WHERE tenant_id = ? AND product_id = ?')) {
            const [tenantId, productId] = values;
            return movements
              .filter((m) => m.tenant_id === tenantId && m.product_id === productId)
              .sort((a, b) => b.created_at - a.created_at);
          }

          if (query.includes('WHERE tenant_id = ? AND reference_type = ? AND reference_id = ?')) {
            const [tenantId, refType, refId] = values;
            return movements
              .filter((m) => m.tenant_id === tenantId && m.reference_type === refType && m.reference_id === refId)
              .sort((a, b) => a.created_at - b.created_at);
          }

          const tenantId = values[0];
          const limit = values[1] || 100;
          return movements
            .filter((m) => !tenantId || m.tenant_id === tenantId)
            .sort((a, b) => b.created_at - a.created_at)
            .slice(0, limit);
        }

        // ── categories SELECT ─────────────────────────────────────────────
        if (query.includes('FROM categories')) {
          const categories = getStorage<any[]>('categories', []);
          if (query.includes('WHERE id = ? AND tenant_id = ?')) {
            const [id, tenantId] = values;
            const item = categories.find((c) => c.id === id && (!tenantId || c.tenant_id === tenantId));
            return item ? [item] : [];
          }
          const tenantId = values[0];
          return categories
            .filter((c) => !tenantId || c.tenant_id === tenantId)
            .sort((a, b) => a.name.localeCompare(b.name));
        }

        if (query.includes('FROM products')) {
          const products = getStorage<any[]>('products', []);
          if (query.includes('COUNT(*)')) {
            const tenantId = values[0];
            const count = products.filter((p) => !tenantId || p.tenant_id === tenantId).length;
            return [{ count }];
          }

          if (query.includes('WHERE id = ?')) {
            const [id, tenantId] = values;
            const item = products.find((p) => p.id === id && p.tenant_id === tenantId && !p.deleted_at);
            return item ? [item] : [];
          }

          if (query.includes('WHERE tenant_id = ? AND sku = ?')) {
            const [tenantId, sku] = values;
            const item = products.find((p) => p.tenant_id === tenantId && p.sku === sku && !p.deleted_at);
            return item ? [item] : [];
          }

          if (query.includes('stock <= minimum_stock')) {
            const tenantId = values[0];
            return products.filter(
              (p) => (!tenantId || p.tenant_id === tenantId) && !p.deleted_at && p.stock <= p.minimum_stock
            );
          }

          if (query.includes('LIKE ?')) {
            const tenantId = values[0];
            const q = (values[1] || '').replace(/%/g, '').toLowerCase();
            return products.filter((p) => {
              if (tenantId && p.tenant_id !== tenantId) return false;
              if (p.deleted_at) return false;
              return (
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q) ||
                (p.barcode && p.barcode.toLowerCase().includes(q))
              );
            });
          }

          const tenantId = values[0];
          return products.filter((p) => (!tenantId || p.tenant_id === tenantId) && !p.deleted_at);
        }

        if (query.includes('FROM orders')) {
          const orders = getStorage<any[]>('orders', []);
          if (query.includes('WHERE id = ?')) {
            const [id, tenantId] = values;
            const item = orders.find((o) => o.id === id && o.tenant_id === tenantId);
            return item ? [item] : [];
          }
          if (query.includes('BETWEEN ? AND ?')) {
            const [tenantId, start, end] = values;
            return orders.filter(
              (o) => o.tenant_id === tenantId && o.created_at >= start && o.created_at <= end
            );
          }
          const tenantId = values[0];
          return orders.filter((o) => !tenantId || o.tenant_id === tenantId);
        }

        // ── pos_orders SELECT ──────────────────────────────────────────────
        if (query.includes('FROM pos_orders')) {
          const pos_orders = getStorage<any[]>('pos_orders', []);

          if (query.includes('COALESCE(MAX(order_number)')) {
            const tenantId = values[0];
            const filtered = pos_orders.filter((o) => !tenantId || o.tenant_id === tenantId);
            const max_num = filtered.reduce((m, o) => Math.max(m, Number(o.order_number) || 0), 0);
            return [{ max_num }];
          }

          if (query.includes('WHERE id = ?')) {
            const [id, tenantId] = values;
            const item = pos_orders.find((o) => o.id === id && (!tenantId || o.tenant_id === tenantId));
            return item ? [item] : [];
          }

          const tenantId = values[0];
          const filtered = pos_orders
            .filter((o) => !tenantId || o.tenant_id === tenantId)
            .sort((a, b) => Number(b.order_number) - Number(a.order_number));
          return filtered;
        }

        if (query.includes('FROM outbox')) {
          const outbox = getStorage<any[]>('outbox', []);
          if (query.includes('COUNT(*)')) {
            const tenantId = values[0];
            const count = outbox.filter(
              (o) => (!tenantId || o.tenant_id === tenantId) && o.status === 'pending'
            ).length;
            return [{ count }];
          }

          const tenantId = values[0];
          const limit = values[1] || 100;
          return outbox
            .filter((o) => (!tenantId || o.tenant_id === tenantId) && o.status === 'pending')
            .slice(0, limit);
        }

        // ── customers SELECT ──────────────────────────────────────────────
        if (query.includes('FROM customers')) {
          const customers = getStorage<any[]>('customers', []);
          if (query.includes('WHERE id = ? AND tenant_id = ?')) {
            const [id, tenantId] = values;
            const item = customers.find((c) => c.id === id && c.tenant_id === tenantId);
            return item ? [item] : [];
          }
          const tenantId = values[0];
          return customers
            .filter((c) => !tenantId || c.tenant_id === tenantId)
            .sort((a, b) => a.name.localeCompare(b.name));
        }

        // ── vehicles SELECT ───────────────────────────────────────────────
        if (query.includes('FROM vehicles')) {
          const vehicles = getStorage<any[]>('vehicles', []);
          if (query.includes('WHERE id = ?')) {
            const [id, tenantId] = values;
            const item = vehicles.find((v) => v.id === id && (!tenantId || v.tenant_id === tenantId));
            return item ? [item] : [];
          }
          if (query.includes('license_plate = ?') || query.includes('license_plate LIKE ?')) {
            const plate = String(values[0] || '').trim().toUpperCase();
            const tenantId = values[1];
            const item = vehicles.find(
              (v) => String(v.license_plate || '').trim().toUpperCase() === plate && (!tenantId || v.tenant_id === tenantId)
            );
            return item ? [item] : [];
          }
          const tenantId = values[0];
          return vehicles
            .filter((v) => !tenantId || v.tenant_id === tenantId)
            .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
        }

        // ── auto_care_invoices SELECT ──────────────────────────────────────
        if (query.includes('FROM auto_care_invoices')) {
          const invoices = getStorage<any[]>('auto_care_invoices', []);
          if (query.includes('COUNT(*)')) {
            const tenantId = values[0];
            const count = invoices.filter((i) => !tenantId || i.tenant_id === tenantId).length;
            return [{ count }];
          }
          if (query.includes('WHERE id = ?')) {
            const [id, tenantId] = values;
            const item = invoices.find((i) => i.id === id && (!tenantId || i.tenant_id === tenantId));
            return item ? [item] : [];
          }
          const tenantId = values[0];
          return invoices
            .filter((i) => !tenantId || i.tenant_id === tenantId)
            .sort((a, b) => b.created_at - a.created_at);
        }

        return [];
      }

      return null;
    },
  };
}
