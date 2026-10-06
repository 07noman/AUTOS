import { useQuery } from '@tanstack/react-query';
import { customerRepo, TENANT_ID } from '@/lib/db';

export function useCustomers(tenantId: string = TENANT_ID) {
  return useQuery({
    queryKey: ['customers', tenantId],
    queryFn: () => customerRepo.findAll(tenantId),
  });
}
