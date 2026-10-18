import { expect, test, type Page } from '@playwright/test';
import { MockApi, PASSCODE } from './mockApi';

let api: MockApi;

test.beforeEach(async ({ context }) => {
  api = new MockApi();
  await api.install(context);
});

async function signIn(page: Page, email = 'oliver@example.com') {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Family passcode').fill(PASSCODE);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.pin').first()).toBeVisible();
}

const sheet = (page: Page) => page.locator('.sheet');

test('login gate: wrong passcode or unknown email shows an inline message, no data', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('stranger@example.com');
  await page.getByLabel('Family passcode').fill(PASSCODE);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText("That email and passcode don't match the family list.");
  await expect(page.locator('.pin')).toHaveCount(0);
  expect(api.requests).not.toContain('GET /api/data');
});

test('page is noindex', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('US1/US2: QS filter, tap Pecos Bill, themed menu with QS and kids badges', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Quick-Service credit', exact: true }).click();
  await expect(page.locator('.pin:not(.pin--quick_service)')).toHaveCount(0);

  await page.locator('[data-id="pecos-bill-tall-tale-inn-and-cafe"]').click();
  const detail = page.getByTestId('detail');
  await expect(detail.getByText('Quick-Service credit', { exact: true })).toBeVisible();
  await expect(detail.locator('.hero')).toBeVisible();
  await expect(detail.locator('.hero .menu-logo')).toBeVisible();
  const menu = detail.locator('.menu');
  await expect(menu).toHaveAttribute('data-theme', 'wanted-poster');
  await expect(menu.getByText(/Menu as of 16 Oct 2026/)).toBeVisible();

  const entree = menu.locator('.menu-section', { hasText: 'Entrées' }).locator('.mi').first();
  await expect(entree.locator('.mi-price')).toHaveText(/^\$\d+\.\d\d$/);
  await expect(entree.locator('.badge')).toHaveText('1 QS credit');
  const kids = menu.locator('.menu-section', { hasText: 'Kids’ meals' }).locator('.mi');
  await expect(kids.first().locator('.badge')).toHaveText('1 QS credit (ages 3–9)');
  // Menu has every seeded item for the location.
  const count = api.snapshot.menu_items.filter((i) => i.location_id === 'pecos-bill-tall-tale-inn-and-cafe').length;
  await expect(menu.locator('.mi')).toHaveCount(count);
});

test('US3: snack filter shows snack-only places and snack badges; unknowns say check', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'EPCOT', exact: true }).click();
  await page.getByRole('button', { name: 'Snack credit' }).click();
  await expect(sheet(page).locator('.row', { hasText: 'Tangierine' })).toBeVisible();
  await sheet(page).locator('.row', { hasText: 'Tangierine' }).click();
  const menu = page.getByTestId('detail').locator('.menu');
  await expect(menu.locator('.badge').first()).toHaveText(/Snack credit|Check DDP symbol/);
  await expect(menu.locator('.badge--qs')).toHaveCount(0);
});

test('step 8: search "pizza" finds names and menu items', async ({ page }) => {
  await signIn(page);
  const search = page.getByPlaceholder(/Search places or dishes/);
  for (const [park, name] of [['Animal Kingdom', 'Pizzafari'], ['EPCOT', 'Pizza al Taglio'], ['Disney Springs', 'Blaze'], ['Disney Springs', 'Pizza Ponte']] as const) {
    await page.getByRole('button', { name: park, exact: true }).click();
    await search.fill('pizza');
    await expect(sheet(page).locator('.row', { hasText: name })).toBeVisible();
  }
  // Menu-item matches are shown under the row.
  await page.getByRole('button', { name: 'Magic Kingdom', exact: true }).click();
  await search.fill('flatbread');
  await expect(sheet(page).locator('.row-match').first()).toContainText(/flatbread/i);
});

test('US4: refill layer shows the free-water rule and water-drop badges', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: /Refills/ }).click();
  await expect(sheet(page).getByText(/Free ice water/)).toBeVisible();
  await expect(page.locator('.pin-badge--cup').first()).toBeVisible();
});

test('US1: with location on the list is nearest first with walking times', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 28.41865, longitude: -81.58395 });
  await signIn(page);
  await expect(page.locator('.me-dot')).toBeVisible();
  const first = sheet(page).locator('.row').first();
  await expect(first).toContainText('Pecos Bill');
  await expect(first.locator('.row-dist')).toHaveText(/min walk/);
  await expect(sheet(page).getByRole('button', { name: /Nearest QS/ })).toBeVisible();
});

test('location denied shows an inline message, never a dialog', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('No browser dialogs allowed');
  });
  await signIn(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: { watchPosition: (_s: unknown, e: (err: { code: number; PERMISSION_DENIED: number }) => void) => (e({ code: 1, PERMISSION_DENIED: 1 }), 1), clearWatch() {} },
    });
  });
  await sheet(page).getByRole('button', { name: /Use my location/ }).click();
  await expect(sheet(page).getByText('Location is off. Turn it on to sort by distance.')).toBeVisible();
});

test('US5: starring syncs to the server and family stars show up', async ({ page }) => {
  api.familyStar('sam@example.com', 'satu-li-canteen');
  await signIn(page);
  await page.getByRole('button', { name: 'Animal Kingdom', exact: true }).click();
  await sheet(page).locator('.row', { hasText: 'Satu' }).click();
  await expect(page.getByText(/Starred by Sam/)).toBeVisible();
  await page.getByRole('button', { name: 'Star', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Starred', exact: true })).toBeVisible();
  await expect.poll(() => api.ops.some((o) => o.kind === 'favourite' && o.location_id === 'satu-li-canteen' && o.starred)).toBe(true);
});

test('US6: works offline after one online visit', async ({ page, context }) => {
  await signIn(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Reload once so the service worker controls the page and has the shell cached.
  await page.reload();
  await expect(page.locator('.pin').first()).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Offline – showing menus saved on/)).toBeVisible();
  await page.locator('[data-id="pecos-bill-tall-tale-inn-and-cafe"]').click();
  const menu = page.getByTestId('detail').locator('.menu');
  await expect(menu.locator('.mi').first()).toBeVisible();
  await expect(page.getByTestId('detail').locator('.hero')).toBeVisible();
  // Fonts come from the precache, so the theme still renders.
  expect(await page.evaluate(() => document.fonts.check("16px 'Rye'"))).toBe(true);
  await context.setOffline(false);
});

test('US7 (admin): edit a price inline and it is queued for the family', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByLabel(/Edit mode/).check();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.locator('[data-id="pecos-bill-tall-tale-inn-and-cafe"]').click();
  const first = page.getByTestId('detail').locator('.mi-edit').first();
  await first.click();
  await page.getByLabel('Price (USD)').fill('15.99');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(first.locator('.mi-price')).toHaveText('$15.99');
  await expect.poll(() => api.ops.some((o) => o.kind === 'item_upsert' && o.item.price_usd === 15.99)).toBe(true);
});

test('members do not see edit mode', async ({ page }) => {
  await signIn(page, 'sam@example.com');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByLabel(/Edit mode/)).toHaveCount(0);
});
