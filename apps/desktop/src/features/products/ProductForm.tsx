import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@genx/ui/Button';
import { Input } from '@genx/ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@genx/ui/Dialog';
import { useCreateProduct } from '@/hooks/useProducts';
import { getCurrentTenantId } from '@/lib/db';

const schema = z.object({
  sku: z.string().min(1),
  name: z.string().min(3),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  stock: z.coerce.number().min(0).default(0),
  minimumStock: z.coerce.number().min(0).default(0),
});

type FormData = z.infer<typeof schema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductForm({ open, onOpenChange }: ProductFormProps) {
  const createProduct = useCreateProduct();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { stock: 0, minimumStock: 0 } });

  const onSubmit = async (data: FormData) => {
    await createProduct.mutateAsync({
      tenantId: getCurrentTenantId(),
      sku: data.sku,
      name: data.name,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      stock: data.stock,
      minimumStock: data.minimumStock,
      status: 'active',
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU *" {...register('sku')} error={errors.sku?.message} />
            <Input label="Name *" {...register('name')} error={errors.name?.message} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Cost *" type="number" step="0.01" {...register('costPrice')} error={errors.costPrice?.message} />
            <Input
              label="Price *"
              type="number"
              step="0.01"
              {...register('sellingPrice')}
              error={errors.sellingPrice?.message}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Stock" type="number" {...register('stock')} />
            <Input label="Min stock" type="number" {...register('minimumStock')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
