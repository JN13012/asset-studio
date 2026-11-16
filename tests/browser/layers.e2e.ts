import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function fixture(page: Page, color: string, width: number, height: number) {
  return Buffer.from(await page.evaluate(({ color, width, height }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = color;
    context.fillRect(0, 0, width / 2, height);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { color, width, height }), 'base64');
}

test('adds and edits independent layers without changing the source', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('input[type=file][accept*=image]');
  await input.setInputFiles({ name: 'base.png', mimeType: 'image/png', buffer: await fixture(page, '#334455', 200, 100) });
  await expect(page.getByText('200 × 100 px')).toBeVisible();
  const original = page.getByRole('img', { name: 'Image source du document' });
  const url = await original.getAttribute('src');
  async function add(name: string, color: string) {
    const buffer = await fixture(page, color, 40, 20);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '+ Image', exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: 'image/png', buffer });
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await add('tour.png', '#ff0000');
  const tower = page.getByRole('img', { name: 'tour.png' });
  await expect(tower).toBeVisible();
  await expect(tower).toHaveCSS('left', '80px');
  await page.getByLabel('X (px)', { exact: true }).fill('20');
  await page.getByLabel('X (px)', { exact: true }).press('Enter');
  await expect(tower).toHaveCSS('left', '20px');
  await expect(page.getByLabel('X (px)', { exact: true })).toHaveValue('20');
  await page.getByLabel('Échelle (%)', { exact: true }).fill('150');
  await page.getByLabel('Échelle (%)', { exact: true }).press('Enter');
  await expect(tower).toHaveCSS('transform', 'matrix(1.5, 0, 0, 1.5, 0, 0)');
  await page.getByRole('slider').fill('40');
  await expect(tower).toHaveCSS('opacity', '0.4');
  await page.getByRole('button', { name: 'Masquer tour.png' }).click();
  await expect(tower).toBeHidden();
  await page.getByRole('button', { name: 'Afficher tour.png' }).click();
  await expect(tower).toBeVisible();
  await page.getByLabel('Nom', { exact: true }).fill('Tour');
  await page.getByLabel('Nom', { exact: true }).press('Enter');
  await expect(page.getByRole('img', { name: 'Tour', exact: true })).toBeVisible();
  await add('avion.png', '#ffff00');
  await page.getByRole('button', { name: 'Descendre le calque' }).click();
  await expect(page.locator('.image-stage img').nth(1)).toHaveAttribute('alt', 'avion.png');
  await page.getByRole('button', { name: 'Verrouiller avion.png' }).click();
  await expect(page.getByRole('button', { name: 'Supprimer' })).toBeDisabled();
  await page.getByRole('button', { name: 'Déverrouiller avion.png' }).click();
  await page.getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.getByRole('img', { name: 'avion.png' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Image source', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Supprimer' })).toBeDisabled();
  await expect(original).toHaveAttribute('src', url!);
});
