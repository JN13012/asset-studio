import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function png(page: Page, width: number, height: number) {
  const encoded = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#0080ff';
    context.fillRect(0, 0, width / 2, height);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { width, height });
  return Buffer.from(encoded, 'base64');
}

test('imports a transparent image, zooms, pans and resets', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Aucun document')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'airport-fixture.png',
    mimeType: 'image/png',
    buffer: await png(page, 96, 64),
  });
  const image = page.getByRole('img', { name: 'Image source du document' });
  await expect(image).toBeVisible();
  await expect(page.getByText('96 × 64 px')).toBeVisible();
  expect(await image.evaluate((element: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(element, 0, 0);
    return [element.naturalWidth, element.naturalHeight, context.getImageData(95, 0, 1, 1).data[3]];
  })).toEqual([96, 64, 0]);
  const zoom = page.getByLabel('Niveau de zoom');
  await expect(zoom).toHaveText('100 %');
  await page.getByRole('button', { name: 'Zoom avant' }).click();
  await expect(zoom).toHaveText('125 %');
  await page.getByRole('button', { name: '100 %', exact: true }).click();
  const before = await image.boundingBox();
  if (!before) throw new Error('Image bounds unavailable');
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 40, before.y + before.height / 2 + 25);
  await page.mouse.up();
  await expect.poll(async () => Math.round((await image.boundingBox())!.x - before.x)).toBe(40);
  await page.getByRole('button', { name: 'Ajuster' }).click();
  await expect.poll(async () => Math.round((await image.boundingBox())!.x - before.x)).toBe(0);
  expect(errors).toEqual([]);
});

test('replaces the image by drop and preserves it when another import fails', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: 'first.png', mimeType: 'image/png', buffer: await png(page, 50, 40) });
  await expect(page.getByText('50 × 40 px')).toBeVisible();
  const bytes = await png(page, 80, 60);
  const dataTransfer = await page.evaluateHandle(encoded => {
    const transfer = new DataTransfer();
    const data = Uint8Array.from(atob(encoded), value => value.charCodeAt(0));
    transfer.items.add(new File([data], 'second.png', { type: 'image/png' }));
    return transfer;
  }, bytes.toString('base64'));
  try {
    await page.locator('.viewport').dispatchEvent('drop', { dataTransfer });
  } finally {
    await dataTransfer.dispose();
  }
  await expect(page.getByText('80 × 60 px')).toBeVisible();
  await input.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('alert')).toContainText('Format non pris en charge');
  await expect(page.getByText('80 × 60 px')).toBeVisible();
  await input.setInputFiles({ name: 'corrupt.png', mimeType: 'image/png', buffer: Buffer.from('not a PNG') });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('second.png', { exact: true })).toBeVisible();
});
