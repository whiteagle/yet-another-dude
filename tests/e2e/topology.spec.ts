import { test, expect } from '@playwright/test'

test.describe('Topology Map', () => {
  test('should display the topology page', async ({ page }) => {
    await page.goto('/topology')
    await expect(page.locator('h2')).toContainText('Network Topology')
  })

  test('should show empty state when no devices', async ({ page }) => {
    await page.goto('/topology')
    // React Flow canvas should be present
    await expect(page.locator('.react-flow')).toBeVisible()
  })

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h2')).toContainText('Dashboard')

    await page.click('a[href="/topology"]')
    await expect(page.locator('h2')).toContainText('Network Topology')

    await page.click('a[href="/devices"]')
    await expect(page.locator('h2')).toContainText('Devices')

    await page.click('a[href="/settings"]')
    await expect(page.locator('h2')).toContainText('Settings')
  })

  test('should show device discovery wizard', async ({ page }) => {
    await page.goto('/devices')
    await page.click('button:has-text("Discover")')
    await expect(page.locator('text=Network Discovery')).toBeVisible()
    await expect(page.locator('input[placeholder="192.168.1.0/24"]')).toBeVisible()
  })
})
