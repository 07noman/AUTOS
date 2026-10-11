import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Product } from '@genx/types/domain/product';
import { productRepo, outboxRepo, getCurrentTenantId } from '@/lib/db';
import { stockMovementRepo } from '@/lib/stock-movements';
import { getDeviceId } from '@/lib/device';
import { recordProductChange } from '@/lib/sync';
import { putItem, putMany, OFFLINE_STORES } from '@/services/offlineDB';
import { setStock } from '@/services/offlineInventory';
import { supabase } from '@/lib/supabase';

// ── Realtime subscription: invalidate queries when another device changes data ─
// Call this once at app startup (e.g. in App.tsx or a layout component).
// Returns an unsubscribe function.
export function subscribeToRealtimeSync(tenantId: string, queryClient: ReturnType<typeof useQueryClient>) {
  const channel = supabase
    .channel(`realtime:tenant:${tenantId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `tenant_id=eq.${tenantId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${tenantId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'customers', filter: `tenant_id=eq.${tenantId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'receipt_settings', filter: `tenant_id=eq.${tenantId}` },
      () => {
        queryClient.invalidateQueries({ queryKey: ['receiptSettings'] });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function useProducts() {
  const tenantId = getCurrentTenantId();
  return useQuery({
    queryKey: ['products', tenantId],
    queryFn: async (): Promise<Product[]> => {
      // ONLY load from Supabase — no local/mock/cached fallback.
      // This guarantees every device sees the same live database data.
      const products = await productRepo.findAll(tenantId);
      if (products && products.length > 0) {
        // Background: keep IndexedDB in sync for offline reads (non-blocking)
        void putMany(OFFLINE_STORES.products, products).catch(() => {});
        for (const p of products) {
          void setStock(p.id, p.stock, p.metadata?.trackInventory !== false).catch(() => {});
        }
      }
      return products ?? [];
    },
    // Always fetch fresh from Supabase on mount — data must match live DB
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}


export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
      const tenantId = getCurrentTenantId();
      const newProduct: Product = {
        ...product,
        tenantId, // always use the current user's tenant — override any passed value
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save to Supabase (primary) + local SQLite (offline fallback)
      await productRepo.create(newProduct);

      // Save to offline IndexedDB
      try {
        await putItem(OFFLINE_STORES.products, newProduct);
        await setStock(newProduct.id, newProduct.stock, newProduct.metadata?.trackInventory !== false);
      } catch (e) {
        console.warn('Could not cache new product to offline DB:', e);
      }

      // Record in outbox for sync
      try {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          tenantId: newProduct.tenantId,
          entityType: 'product',
          entityId: newProduct.id,
          operation: 'create',
          payload: newProduct,
        });
      } catch {
        // ignore
      }

      // Record initial stock movement in ledger if stock > 0
      if (newProduct.stock > 0) {
        try {
          const deviceId = await getDeviceId();
          const movementId = crypto.randomUUID();
          await stockMovementRepo.insert({
            id: movementId,
            tenantId: newProduct.tenantId,
            productId: newProduct.id,
            quantityDelta: newProduct.stock,
            movementType: 'ADJUSTMENT',
            referenceType: 'manual',
            referenceId: newProduct.id,
            deviceId,
            notes: 'Initial stock',
            createdAt: newProduct.createdAt,
          });

          await outboxRepo.insert({
            id: crypto.randomUUID(),
            tenantId: newProduct.tenantId,
            entityType: 'stock_movement',
            entityId: movementId,
            operation: 'create',
            payload: {
              id: movementId,
              tenantId: newProduct.tenantId,
              productId: newProduct.id,
              quantityDelta: newProduct.stock,
              movementType: 'ADJUSTMENT',
              referenceType: 'product',
              referenceId: newProduct.id,
              deviceId,
              notes: 'Initial stock',
              createdAt: newProduct.createdAt,
            },
          });
        } catch (e) {
          console.warn('Could not record initial stock movement:', e);
        }
      }

      // Trigger sync
      void recordProductChange('create', newProduct);

      return newProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Partial<Product> & { id: string; tenantId: string }) => {
      const tenantId = getCurrentTenantId();
      const safeProduct = { ...product, tenantId }; // enforce current user's tenant

      await productRepo.update(safeProduct);

      // Record in outbox
      await outboxRepo.insert({
        id: crypto.randomUUID(),
        tenantId,
        entityType: 'product',
        entityId: product.id,
        operation: 'update',
        payload: safeProduct,
      });

      recordProductChange('update', safeProduct);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useCategories() {
  const tenantId = getCurrentTenantId();
  return useQuery({
    queryKey: ['categories', tenantId],
    queryFn: async () => {
      try {
        const { categoryRepo } = await import('@/lib/db');
        return await categoryRepo.findAll(tenantId);
      } catch (err) {
        console.warn('Failed to fetch categories:', err);
        return [];
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const tenantId = getCurrentTenantId();
      const now = Date.now();
      const newCategory = {
        id: crypto.randomUUID(),
        tenantId,
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
      };
      const { categoryRepo } = await import('@/lib/db');
      await categoryRepo.create(newCategory);
      return newCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const tenantId = getCurrentTenantId();
      await productRepo.delete(tenantId, id);

      // Record in outbox for sync
      try {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          tenantId,
          entityType: 'product',
          entityId: id,
          operation: 'delete',
          payload: { id },
        });
      } catch (err) {
        console.warn('Could not record product delete outbox:', err);
      }

      void recordProductChange('delete', { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      quantityDelta,
      notes,
    }: {
      productId: string;
      quantityDelta: number;
      notes?: string;
    }) => {
      const tenantId = getCurrentTenantId();
      const deviceId = await getDeviceId();
      const movementId = crypto.randomUUID();
      const now = Date.now();

      // Check current product stock
      const product = await productRepo.findById(tenantId, productId);
      if (!product) throw new Error('Product not found');

      const newStock = product.stock + quantityDelta;
      if (newStock < 0) {
        throw new Error(`Cannot reduce stock below 0. Current stock is ${product.stock}`);
      }

      // Update product table stock (Supabase + local)
      await productRepo.updateStock(tenantId, productId, quantityDelta);

      // Record immutable stock movement ledger
      await stockMovementRepo.insert({
        id: movementId,
        tenantId,
        productId,
        quantityDelta,
        movementType: 'ADJUSTMENT',
        referenceType: 'manual',
        referenceId: movementId,
        deviceId,
        notes: notes || 'Manual inventory adjustment',
        createdAt: now,
      });

      // Mirror to outbox for cloud sync
      try {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          tenantId,
          entityType: 'stock_movement',
          entityId: movementId,
          operation: 'create',
          payload: {
            id: movementId,
            tenantId,
            productId,
            quantityDelta,
            movementType: 'ADJUSTMENT',
            referenceType: 'manual',
            referenceId: movementId,
            deviceId,
            notes: notes || 'Manual inventory adjustment',
            createdAt: now,
          },
        });
      } catch (err) {
        console.warn('Could not record adjustment outbox:', err);
      }

      // Update offline DB
      try {
        await setStock(productId, newStock, product.metadata?.trackInventory !== false);
      } catch (e) {
        console.warn('Could not update offline stock store:', e);
      }

      return { productId, newStock };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Hook to activate Supabase Realtime for the current tenant
// Use this in App.tsx or a top-level layout component
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const tenantId = getCurrentTenantId();

  useEffect(() => {
    if (!tenantId || tenantId === 'tenant-1') return;
    const unsub = subscribeToRealtimeSync(tenantId, queryClient);
    return unsub;
  }, [tenantId, queryClient]);
}
