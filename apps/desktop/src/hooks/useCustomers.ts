import { useQuery } from '@tanstack/react-query';
import { customerRepo, getCurrentTenantId } from '@/lib/db';

export function useCustomers(tenantId?: string) {
  const effectiveTenantId = tenantId ?? getCurrentTenantId();
  return useQuery({
    queryKey: ['customers', effectiveTenantId],
    queryFn: () => customerRepo.findAll(effectiveTenantId),
  });
}
