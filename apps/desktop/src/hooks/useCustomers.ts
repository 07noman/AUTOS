import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerRepo, outboxRepo, getCurrentTenantId } from '@/lib/db';
import type { Customer } from '@genx/types/domain/customer';

export function useCustomers(tenantId?: string) {
  const effectiveTenantId = tenantId ?? getCurrentTenantId();
  return useQuery({
    queryKey: ['customers', effectiveTenantId],
    queryFn: () => customerRepo.findAll(effectiveTenantId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useCustomer(id: string, tenantId?: string) {
  const effectiveTenantId = tenantId ?? getCurrentTenantId();
  return useQuery({
    queryKey: ['customer', effectiveTenantId, id],
    queryFn: () => customerRepo.findById(effectiveTenantId, id),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      phone?: string;
      email?: string;
      address?: string;
      creditLimit?: number;
    }) => {
      const tenantId = getCurrentTenantId();
      const customer = await customerRepo.create({
        id: crypto.randomUUID(),
        tenantId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        balance: 0,
        creditLimit: data.creditLimit ?? 0,
      });

      // Queue in outbox for sync
      try {
        await outboxRepo.insert({
          id: crypto.randomUUID(),
          tenantId,
          entityType: 'customer',
          entityId: customer.id,
          operation: 'create',
          payload: customer,
        });
      } catch {
        // ignore in mock/offline
      }

      return customer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
