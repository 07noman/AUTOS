import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Product } from '@genx/types/domain/product';
import { productRepo, outboxRepo, getCurrentTenantId } from '@/lib/db';
import { stockMovementRepo } from '@/lib/stock-movements';
import { getDeviceId } from '@/lib/device';
import { recordProductChange } from '@/lib/sync';
import { putItem, putMany, getAllItems, OFFLINE_STORES } from '@/services/offlineDB';
import { setStock } from '@/services/offlineInventory';

export function useProducts() {
  const tenantId = getCurrentTenantId();
  return useQuery({
    queryKey: ['products', tenantId],
    queryFn: async (): Promise<Product[]> => {
      try {
        const products = await productRepo.findAll(tenantId);
        if (products && products.length > 0) {
          // Cache to IndexedDB for offline use
          void putMany(OFFLINE_STORES.products, products).catch(() => {});
          // Sync inventory store
          for (const p of products) {
            void setStock(p.id, p.stock, p.metadata?.trackInventory !== false).catch(() => {});
          }
          return products;
        }
      } catch (err) {
        console.warn('Failed to load products from repo, checking offline DB:', err);
      }

      // Offline fallback: load from IndexedDB (still same tenant, cached earlier)
      try {
        const offlineProducts = await getAllItems(OFFLINE_STORES.products);
        if (offlineProducts && offlineProducts.length > 0) {
          return offlineProducts;
        }
      } catch (idbErr) {
        console.warn('IndexedDB fallback error:', idbErr);
      }

      return [];
    },
    staleTime: 1000 * 30, // 30 seconds
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

      // Save to local SQLite database
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
    staleTime: 1000 * 60,
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

      // Update product table stock
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


