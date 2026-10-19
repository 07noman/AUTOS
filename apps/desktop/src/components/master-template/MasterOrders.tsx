import React from 'react';
import { useParams } from 'react-router-dom';
import { POSOrdersPage } from '@/features/auto-care/POSOrdersPage';
import { resolveBusinessType, type BusinessTypeKey } from '@/lib/businessTypes';

interface MasterOrdersProps {
  businessType?: BusinessTypeKey | string;
}

export function MasterOrders({ businessType: propType }: MasterOrdersProps) {
  const params = useParams<{ businessType?: string }>();
  const bKey = resolveBusinessType(propType || params.businessType);

  return <POSOrdersPage />;
}

export default MasterOrders;
