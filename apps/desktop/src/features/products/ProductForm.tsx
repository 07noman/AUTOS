import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@genx/ui/Button';
import { Input } from '@genx/ui/Input';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@genx/ui/Dialog';
import { useCreateProduct, useCategories, useCreateCategory } from '@/hooks/useProducts';
import { getCurrentTenantId } from '@/lib/db';
import { useState } from 'react';
import { Plus } from 'lucide-react';

const schema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  categoryId: z.string().optional(),
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
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [newCatName, setNewCatName] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { stock: 0, minimumStock: 0, categoryId: '' } });

  const onSubmit = async (data: FormData) => {
    await createProduct.mutateAsync({
      tenantId: getCurrentTenantId(),
      sku: data.sku,
      name: data.name,
      categoryId: data.categoryId && data.categoryId !== '' ? data.categoryId : undefined,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      stock: data.stock,
      minimumStock: data.minimumStock,
      status: 'active',
    });
    reset();
    onOpenChange(false);
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await createCategory.mutateAsync(newCatName.trim());
      setValue('categoryId', created.id);
      setNewCatName('');
      setShowAddCat(false);
    } catch (err) {
      console.error('Failed to create category:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU / Internal Ref *" {...register('sku')} error={errors.sku?.message} />
            <Input label="Product Name *" {...register('name')} error={errors.name?.message} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Category</label>
              <button
                type="button"
                onClick={() => setShowAddCat(!showAddCat)}
                className="text-xs text-[#79556f] hover:underline flex items-center gap-1 font-medium"
              >
                <Plus className="h-3 w-3" />
                {showAddCat ? 'Cancel' : 'New Category'}
              </button>
            </div>

            {showAddCat && (
              <div className="flex gap-2 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  type="text"
                  placeholder="New category name..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 text-sm px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-[#79556f]"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateCategory}
                  isLoading={createCategory.isPending}
                  className="bg-[#79556f] text-white hover:bg-[#63435a]"
                >
                  Add
                </Button>
              </div>
            )}

            <select
              {...register('categoryId')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#79556f]"
            >
              <option value="">No Category (Uncategorized)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Cost (PKR) *" type="number" step="0.01" {...register('costPrice')} error={errors.costPrice?.message} />
            <Input
              label="Sales Price (PKR) *"
              type="number"
              step="0.01"
              {...register('sellingPrice')}
              error={errors.sellingPrice?.message}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Initial Stock" type="number" {...register('stock')} />
            <Input label="Min Stock Alert" type="number" {...register('minimumStock')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="bg-[#79556f] text-white hover:bg-[#63435a]">
              Save Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
