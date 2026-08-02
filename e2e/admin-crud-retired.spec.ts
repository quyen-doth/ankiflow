import { expect, test } from '@playwright/test'

const RETIRED_ADMIN_CRUD_PATHS = [
  '/api/admin/categories',
  '/api/admin/decks',
  '/api/admin/card-types',
  '/api/admin/topics',
] as const

const CRUD_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const

test.describe('Retired admin CRUD API', () => {
  for (const path of RETIRED_ADMIN_CRUD_PATHS) {
    for (const method of CRUD_METHODS) {
      test(`${method} ${path} は session cookie 通過後に 404`, async ({ request }) => {
        const response = await request.fetch(path, {
          method,
          headers: { cookie: '__session=retired-route-probe' },
        })

        expect(response.status()).toBe(404)
      })
    }
  }

  test('session cookie がない request は route 解決前に middleware で 401', async ({ request }) => {
    const response = await request.get(RETIRED_ADMIN_CRUD_PATHS[0])

    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
  })
})
