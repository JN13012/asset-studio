import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

test('copies a triangular source selection into an alpha layer and moves it', async ({ page }) => {
  await page.goto('/');
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 120;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 200, 120);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file][accept*=image]').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') });
  const source = page.getByRole('img', { name: 'Image source du document' });
  await expect(source).toBeVisible();
  const original = await source.getAttribute('src');
  await page.getByRole('button', { name: '100 %', exact: true }).click();
  await page.getByRole('button', { name: 'Lasso polygonal' }).click();
  const rect = await source.boundingBox();
  if (!rect) throw new Error('Source bounds missing');
  await page.mouse.click(rect.x + 20, rect.y + 20);
  await page.mouse.click(rect.x + 80, rect.y + 20);
  await page.mouse.click(rect.x + 20, rect.y + 80);
  await page.getByRole('button', { name: 'Copier en calque' }).click();
  const object = page.getByRole('img', { name: 'Objet détouré' });
  await expect(object).toBeVisible();
  await expect(object).toHaveCSS('left', '20px');
  expect(await object.evaluate((element: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = element.naturalWidth;
    canvas.height = element.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(element, 0, 0);
    return [element.naturalWidth, element.naturalHeight, context.getImageData(5, 5, 1, 1).data[3], context.getImageData(55, 55, 1, 1).data[3]];
  })).toEqual([60, 60, 255, 0]);
  const bounds = await object.boundingBox();
  if (!bounds) throw new Error('Cutout bounds missing');
  await page.mouse.move(bounds.x + 10, bounds.y + 10);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 50, bounds.y + 30);
  await page.mouse.up();
  await expect(object).toHaveCSS('left', '60px');
  await expect(object).toHaveCSS('top', '40px');
  await expect(source).toHaveAttribute('src', original!);
});
