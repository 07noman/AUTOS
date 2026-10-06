import { test, expect } from '../fixtures/base.fixture';

test.describe('POS Module', () => {
  test('should add product to cart', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/pos');
    
    // Click on first product
    await authenticatedPage.click('button:has-text("Premium Coffee Beans")');
    
    // Verify cart has item
    await expect(authenticatedPage.locator('text=Premium Coffee Beans')).toBeVisible();
    await expect(authenticatedPage.locator('text=Complete Sale')).toBeVisible();
  });

  test('should complete sale with cash payment', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/pos');
    
    // Add product to cart
    await authenticatedPage.click('button:has-text("Premium Coffee Beans")');
    
    // Select cash payment
    await authenticatedPage.click('button:has-text("Cash")');
    
    // Enter cash received
    await authenticatedPage.fill('input[placeholder="Cash received"]', '50');
    
    // Complete sale
    await authenticatedPage.click('button:has-text("Complete Sale")');
    
    // Verify success message
    await expect(authenticatedPage.locator('text=Sale completed')).toBeVisible();
  });

  test('should hold order and resume', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/pos');
    
    // Add product
    await authenticatedPage.click('button:has-text("Croissant")');
    
    // Hold order (F5)
    await authenticatedPage.keyboard.press('F5');
    
    // Verify cart is empty
    await expect(authenticatedPage.locator('text=Cart is empty')).toBeVisible();
    
    // Resume order (F6)
    await authenticatedPage.keyboard.press('F6');
    await authenticatedPage.click('button:has-text("Resume")');
    
    // Verify product is back in cart
    await expect(authenticatedPage.locator('text=Croissant')).toBeVisible();
  });

  test('should search products', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('http://localhost:3000/pos');
    
    // Search for product
    await authenticatedPage.fill('input[placeholder*="Search products"]', 'coffee');
    
    // Verify filtered results
    await expect(authenticatedPage.locator('text=Premium Coffee Beans')).toBeVisible();
    await expect(authenticatedPage.locator('text=Latte')).toBeVisible();
  });
});
