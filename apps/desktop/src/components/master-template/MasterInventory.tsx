import React from 'react';
import { useParams } from 'react-router-dom';
import { InventoryView } from '@/features/inventory/InventoryView';
import { resolveBusinessType, type BusinessTypeKey } from '@/lib/businessTypes';

interface MasterInventoryProps {
  businessType?: BusinessTypeKey | string;
}

export function MasterInventory({ businessType: propType }: MasterInventoryProps) {
  const params = useParams<{ businessType?: string }>();
  const bKey = resolveBusinessType(propType || params.businessType);

  return <InventoryView />;
}

export default MasterInventory;
