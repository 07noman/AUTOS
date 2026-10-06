import { test, expect } from '../fixtures/base.fixture';

test.describe('Product Management', () => {
  test('should display product list', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/products');
    
    // Verify table is visible
    await expect(authenticatedPage.locator('table')).toBeVisible();
    
    // Verify products are listed
    await expect(authenticatedPage.locator('text=Premium Coffee Beans')).toBeVisible();
  });

  test('should create new product', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/products');
    
    // Click Add Product
    await authenticatedPage.click('button:has-text("Add Product")');
    
    // Fill form
    await authenticatedPage.fill('input[label*="SKU"]', 'TEST-001');
    await authenticatedPage.fill('input[label*="Product Name"]', 'Test Product');
    await authenticatedPage.fill('input[label*="Cost Price"]', '10');
    await authenticatedPage.fill('input[label*="Selling Price"]', '15');
    
    // Submit
    await authenticatedPage.click('button:has-text("Save Product")');
    
    // Verify product appears in list
    await expect(authenticatedPage.locator('text=Test Product')).toBeVisible();
  });

  test('should search products', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/products');
    
    // Search
    await authenticatedPage.fill('input[placeholder*="Search products"]', 'coffee');
    
    // Verify results
    await expect(authenticatedPage.locator('text=Premium Coffee Beans')).toBeVisible();
  });

  test('should show low stock alerts', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/dashboard');
    
    // Verify low stock section
    await expect(authenticatedPage.locator('text=Low Stock')).toBeVisible();
  });
});
