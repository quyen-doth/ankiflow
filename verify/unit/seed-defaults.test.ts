import { describe, expect, it, beforeEach } from 'vitest'
import {
  seedUserDefaults,
  publishTemplateDefaults,
  userScopedId,
  DEFAULT_CATEGORIES,
  DEFAULT_CARD_TYPES,
  DEFAULT_DECKS,
} from '@/lib/seed-defaults'
import { DEFAULTS_OWNER_ID } from '@/lib/constants'

/**
 * Fake tối giản cho Firestore Admin SDK (khác firestore-stub.ts — stub đó mô phỏng
 * CLIENT SDK 'firebase/firestore'; seed-defaults.ts nhận `db: Firestore` (Admin SDK,
 * duck-typed) làm tham số nên chỉ cần fake .collection().doc()/.where().get()/.set()).
 */
interface FakeDoc {
  id: string
  data: Record<string, unknown>
}

function makeFakeAdminDb() {
  const store = new Map<string, Map<string, Record<string, unknown>>>()

  const collection = (name: string) => {
    if (!store.has(name)) store.set(name, new Map())
    const docs = store.get(name)!
    return {
      doc: (id: string) => ({
        get: async () => ({
          exists: docs.has(id),
          data: () => docs.get(id),
        }),
        set: async (data: Record<string, unknown>) => {
          docs.set(id, data)
        },
      }),
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => {
          const matched: FakeDoc[] = []
          for (const [id, data] of docs.entries()) {
            if (data[field] === value) matched.push({ id, data })
          }
          return { docs: matched.map((d) => ({ id: d.id, data: () => d.data })) }
        },
      }),
    }
  }

  return {
    collection,
    _dump: (name: string) => store.get(name) ?? new Map(),
  } as unknown as FirebaseFirestore.Firestore & { _dump: (name: string) => Map<string, Record<string, unknown>> }
}

beforeEach(() => {
  // seedUserDefaults/publishTemplateDefaults không log — không cần silence console
})

describe('userScopedId', () => {
  it('nối defaultId + uid bằng "__"', () => {
    expect(userScopedId('cat_daily', 'abc123')).toBe('cat_daily__abc123')
  })
})

describe('seedUserDefaults — chưa có template (lazy-publish từ hardcode)', () => {
  it('publish template rồi seed cho user từ chính template vừa publish', async () => {
    const db = makeFakeAdminDb()

    await seedUserDefaults(db, 'user1')

    // Template đã được lazy-publish với ID KHÔNG suffix (trùng hardcode)
    const catTemplates = db._dump('categories')
    expect(catTemplates.has('cat_daily')).toBe(true)
    expect(catTemplates.get('cat_daily')?.user_id).toBe(DEFAULTS_OWNER_ID)

    // User1 nhận bản clone suffix uid
    const userCat = catTemplates.get(userScopedId('cat_daily', 'user1'))
    expect(userCat).toBeDefined()
    expect(userCat?.user_id).toBe('user1')
    expect(userCat?.name).toBe(DEFAULT_CATEGORIES[0].name)

    // Số lượng đúng: N template + N user1 cho mỗi collection
    expect(catTemplates.size).toBe(DEFAULT_CATEGORIES.length * 2)
  })

  it('FK re-map trong decks: default_card_type_ids/default_category_id trỏ đúng bản của user', async () => {
    const db = makeFakeAdminDb()
    await seedUserDefaults(db, 'user1')

    const decks = db._dump('decks')
    const firstDefault = DEFAULT_DECKS[0]
    const userDeck = decks.get(userScopedId(firstDefault.id, 'user1'))
    expect(userDeck).toBeDefined()

    const expectedCardTypeIds = firstDefault.default_card_type_ids.map((id) => userScopedId(id, 'user1'))
    expect(userDeck?.default_card_type_ids).toEqual(expectedCardTypeIds)
    expect(userDeck?.default_category_id).toBe(userScopedId(firstDefault.default_category_id as string, 'user1'))

    // FK trỏ tới card_types CỦA CHÍNH USER1 (không phải template chưa suffix)
    const cardTypes = db._dump('card_types')
    for (const ctId of expectedCardTypeIds) {
      expect(cardTypes.has(ctId)).toBe(true)
      expect(cardTypes.get(ctId)?.user_id).toBe('user1')
    }
  })

  it('idempotent — chạy lại không tạo trùng, không ghi đè doc đã tồn tại', async () => {
    const db = makeFakeAdminDb()
    await seedUserDefaults(db, 'user1')
    const sizeAfterFirst = db._dump('categories').size

    // Giả lập user đã tự sửa tên category của mình
    const scopedId = userScopedId('cat_daily', 'user1')
    db._dump('categories').get(scopedId)!.name = 'Customized by user'

    await seedUserDefaults(db, 'user1')

    expect(db._dump('categories').size).toBe(sizeAfterFirst)
    expect(db._dump('categories').get(scopedId)?.name).toBe('Customized by user')
  })
})

describe('seedUserDefaults — ĐÃ có template (admin đã sửa qua /admin)', () => {
  it('clone từ template đã sửa, KHÔNG dùng hardcode gốc', async () => {
    const db = makeFakeAdminDb()
    await publishTemplateDefaults(db)

    // Admin sửa tên category template (giống thao tác qua CategoryManager ownerId=__defaults__)
    const templateCatId = DEFAULT_CATEGORIES[0].id
    db._dump('categories').get(templateCatId)!.name = 'Renamed by admin'

    await seedUserDefaults(db, 'user2')

    const userCatId = userScopedId(templateCatId, 'user2')
    expect(db._dump('categories').get(userCatId)?.name).toBe('Renamed by admin')
  })

  it('admin thêm 1 category MỚI vào template → user mới nhận luôn, không cần đổi code', async () => {
    const db = makeFakeAdminDb()
    await publishTemplateDefaults(db)

    // Admin thêm category mới trực tiếp vào template (mô phỏng addDoc qua CategoryManager)
    await db.collection('categories').doc('cat_custom_admin').set({
      user_id: DEFAULTS_OWNER_ID,
      name: 'Custom Admin Category',
      sort_order: 99,
      is_active: true,
    })

    await seedUserDefaults(db, 'user3')

    const cloned = db._dump('categories').get(userScopedId('cat_custom_admin', 'user3'))
    expect(cloned).toBeDefined()
    expect(cloned?.name).toBe('Custom Admin Category')
  })

  it('không lazy-publish lại khi ĐÃ có ít nhất 1 loại template (tránh ghi đè sửa đổi của admin)', async () => {
    const db = makeFakeAdminDb()
    // Chỉ publish categories (mô phỏng admin mới sửa 1 loại, các loại khác chưa publish)
    await db.collection('categories').doc(DEFAULT_CATEGORIES[0].id).set({
      user_id: DEFAULTS_OWNER_ID,
      name: 'Only this one published',
      sort_order: 1,
      is_active: true,
    })

    await seedUserDefaults(db, 'user4')

    // categories: dùng đúng template đã publish (1 doc), KHÔNG bị lazy-publish đè thêm 9 cái kia
    const catTemplates = [...db._dump('categories').values()].filter((d) => d.user_id === DEFAULTS_OWNER_ID)
    expect(catTemplates).toHaveLength(1)
    // card_types/topics/decks: KHÔNG có template nào → vẫn seed cho user4 (không rơi vào trường hợp rỗng)
    const userCardTypes = [...db._dump('card_types').values()].filter((d) => d.user_id === 'user4')
    expect(userCardTypes.length).toBe(DEFAULT_CARD_TYPES.length)
  })
})

describe('publishTemplateDefaults', () => {
  it('idempotent — không ghi đè template đã publish', async () => {
    const db = makeFakeAdminDb()
    await publishTemplateDefaults(db)
    db._dump('categories').get(DEFAULT_CATEGORIES[0].id)!.name = 'Admin edited'

    await publishTemplateDefaults(db)

    expect(db._dump('categories').get(DEFAULT_CATEGORIES[0].id)?.name).toBe('Admin edited')
  })

  it('template deck giữ nguyên default_card_type_ids KHÔNG suffix (tham chiếu template khác)', async () => {
    const db = makeFakeAdminDb()
    await publishTemplateDefaults(db)

    const templateDeck = db._dump('decks').get(DEFAULT_DECKS[0].id)
    expect(templateDeck?.default_card_type_ids).toEqual(DEFAULT_DECKS[0].default_card_type_ids)
  })
})
