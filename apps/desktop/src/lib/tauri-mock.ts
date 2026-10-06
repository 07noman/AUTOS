// Browser mock for Tauri SQL plugin when running outside Tauri desktop shell (e.g. vite dev in browser)

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
          query.startsWith('ROLLBACK')
        ) {
          return [0, 0];
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
          const [id, tenant_id, entity_type, entity_id, operation, payload, status, created_at] = values;
          outbox.push({
            id, tenant_id, entity_type, entity_id, operation, payload,
            status: status || 'pending',
            attempts: 0,
            last_attempt_at: null,
            synced_at: null,
            error: null,
            created_at: created_at || Date.now(),
          });
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
          const [
            id, tenant_id, order_number, status, customer_name, customer_id,
            payment_method, subtotal, tax, total, paid_amount, items, notes,
            created_at, updated_at
          ] = values;
          pos_orders.push({
            id, tenant_id, order_number, status, customer_name, customer_id,
            payment_method, subtotal, tax, total, paid_amount,
            items: typeof items === 'string' ? items : JSON.stringify(items),
            notes, created_at, updated_at,
          });
          setStorage('pos_orders', pos_orders);
          return [1, 1];
        }

        // ── pos_orders UPDATE (PAID / CANCELLED) ──────────────────────────
        if (query.startsWith('UPDATE pos_orders SET status=')) {
          const pos_orders = getStorage<any[]>('pos_orders', []);
          // We match both update patterns: PAID update and CANCELLED update
          if (query.includes('payment_method=?')) {
            // PAID update: SET status='PAID', payment_method=?, paid_amount=?, subtotal=?, tax=?, total=?, items=?, customer_name=?, customer_id=?, updated_at=? WHERE id=? AND tenant_id=?
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
            // CANCELLED update: SET status='CANCELLED', updated_at=? WHERE id=? AND tenant_id=?
            const [updated_at, id, tenant_id] = values;
            const idx = pos_orders.findIndex((o) => o.id === id && o.tenant_id === tenant_id);
            if (idx >= 0) {
              pos_orders[idx] = { ...pos_orders[idx], status: 'CANCELLED', updated_at };
              setStorage('pos_orders', pos_orders);
            }
          }
          return [1, 1];
        }

        return [0, 0];
      }

      if (cmd === 'plugin:sql|select') {
        const query: string = (args.query || '').trim();
        const values: any[] = args.values || [];

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

        return [];
      }

      return null;
    },
  };
}
