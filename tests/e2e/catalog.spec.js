import { expect, test } from '@playwright/test';

function trackRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

test('homepage renders the searchable empty catalog', async ({ page }) => {
  const runtimeErrors = trackRuntimeErrors(page);

  await page.goto('/index.html');

  await expect(
    page.getByRole('heading', { name: /thành phần giao diện/i, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole('searchbox')).toBeVisible();
  await expect(page.getByText('Chưa có component nào')).toBeVisible();
  await expect(page.getByText('0 kết quả')).toBeVisible();

  await page.getByRole('searchbox').fill('button');
  await expect(page.getByText('0 kết quả')).toBeVisible();
  await expect(runtimeErrors).toEqual([]);
});

test('detail page without an id renders a helpful not-found state', async ({ page }) => {
  const runtimeErrors = trackRuntimeErrors(page);

  await page.goto('/component.html');

  await expect(page.getByRole('heading', { name: 'Không tìm thấy component' })).toBeVisible();
  await expect(page.getByText(/URL chưa có tham số id/i)).toBeVisible();
  await expect(runtimeErrors).toEqual([]);
});

test('unknown component id remains recoverable through catalog navigation', async ({ page }) => {
  const runtimeErrors = trackRuntimeErrors(page);

  await page.goto('/component.html?id=unknown-component');

  await expect(page.getByText(/Không có component mang ID/i)).toBeVisible();
  await page.getByRole('link', { name: 'Về trang danh mục' }).click();
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(
    page.getByRole('heading', { name: /thành phần giao diện/i, level: 1 }),
  ).toBeVisible();
  await expect(runtimeErrors).toEqual([]);
});
