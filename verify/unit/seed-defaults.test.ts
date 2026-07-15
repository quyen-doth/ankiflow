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
  it('defaultId + uid を "__" で連結', () => {
    expect(userScopedId('cat_daily', 'abc123')).toBe('cat_daily__abc123')
  })
})

describe('seedUserDefaults — テンプレートがない場合 (hardcode から lazy-publish)', () => {
  it('template を publish してから、その publish したてのテンプレートから user に seed', async () => {
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

  it('decks 内の FK re-map: default_card_type_ids/default_category_id が正しく user のバージョンを指す', async () => {
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

  it('idempotent — 再実行しても重複作成せず、既存 doc を上書きしない', async () => {
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

describe('seedUserDefaults — テンプレートが既にある場合 (admin が /admin 経由で編集済み)', () => {
  it('編集済みテンプレートからクローンし、元の hardcode は使わない', async () => {
    const db = makeFakeAdminDb()
    await publishTemplateDefaults(db)

    // Admin sửa tên category template (giống thao tác qua CategoryManager ownerId=__defaults__)
    const templateCatId = DEFAULT_CATEGORIES[0].id
    db._dump('categories').get(templateCatId)!.name = 'Renamed by admin'

    await seedUserDefaults(db, 'user2')

    const userCatId = userScopedId(templateCatId, 'user2')
    expect(db._dump('categories').get(userCatId)?.name).toBe('Renamed by admin')
  })

  it('admin がテンプレートに新しい category を 1 つ追加 → 新規 user がすぐに受け取る、コード変更不要', async () => {
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

  it('admin が編集した全 field (form type、description、active、template、deck FK) を user clone に保持', async () => {
    const db = makeFakeAdminDb()
    await db.collection('categories').doc('cat_admin').set({
      user_id: DEFAULTS_OWNER_ID,
      name: 'Admin Category',
      form_type: 'form_general',
      sort_order: 11,
      is_active: false,
    })
    await db.collection('card_types').doc('ct_admin').set({
      user_id: DEFAULTS_OWNER_ID,
      code: 'admin_card',
      name: 'Admin Card',
      description: 'Admin description',
      form_type: 'form_general',
      language: null,
      is_default: true,
      is_active: false,
      sort_order: 12,
      template: { front: ['word'], back: ['meaning'] },
    })
    await db.collection('topics').doc('topic_admin').set({
      user_id: DEFAULTS_OWNER_ID,
      name: 'Admin Topic',
      form_type: 'form_it',
      is_active: false,
      sort_order: 13,
    })
    await db.collection('decks').doc('deck_admin').set({
      user_id: DEFAULTS_OWNER_ID,
      anki_deck_name: 'Admin::Deck',
      display_name: 'Admin Deck',
      form_type: 'form_general',
      language: null,
      default_card_type_ids: ['ct_admin'],
      default_category_id: 'cat_admin',
      is_active: false,
      sort_order: 14,
    })

    await seedUserDefaults(db, 'user-fields')

    expect(db._dump('categories').get(userScopedId('cat_admin', 'user-fields'))).toMatchObject({
      form_type: 'form_general',
      is_active: false,
    })
    expect(db._dump('card_types').get(userScopedId('ct_admin', 'user-fields'))).toMatchObject({
      description: 'Admin description',
      is_active: false,
      template: { front: ['word'], back: ['meaning'] },
    })
    expect(db._dump('topics').get(userScopedId('topic_admin', 'user-fields'))).toMatchObject({
      form_type: 'form_it',
      is_active: false,
    })
    expect(db._dump('decks').get(userScopedId('deck_admin', 'user-fields'))).toMatchObject({
      default_card_type_ids: [userScopedId('ct_admin', 'user-fields')],
      default_category_id: userScopedId('cat_admin', 'user-fields'),
      is_active: false,
    })
  })

  it('少なくとも 1 種類のテンプレートが既にある場合は lazy-publish しない (admin の変更を上書きしないため)', async () => {
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
  it('idempotent — publish 済みのテンプレートを上書きしない', async () => {
    const db = makeFakeAdminDb()
    await publishTemplateDefaults(db)
    db._dump('categories').get(DEFAULT_CATEGORIES[0].id)!.name = 'Admin edited'

    await publishTemplateDefaults(db)

    expect(db._dump('categories').get(DEFAULT_CATEGORIES[0].id)?.name).toBe('Admin edited')
  })

  it('template deck は default_card_type_ids をサフィックスなしのまま保持 (別のテンプレートを参照)', async () => {
    const db = makeFakeAdminDb()
    await publishTemplateDefaults(db)

    const templateDeck = db._dump('decks').get(DEFAULT_DECKS[0].id)
    expect(templateDeck?.default_card_type_ids).toEqual(DEFAULT_DECKS[0].default_card_type_ids)
  })
})
