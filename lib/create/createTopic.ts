import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FormType } from '@/types'

export interface CreatedTopic {
  id: string
  name: string
  sort_order: number
  is_active: true
}

/** Topic 名の重複判定に使う正規化。 */
export function normalizeTopicName(name: string): string {
  return name.trim().toLocaleLowerCase('en-US')
}

/** Create ページから現在のユーザー用 IT Topic を作成する。 */
export async function createTopic(params: {
  userId: string
  name: string
  sortOrder: number
}): Promise<CreatedTopic> {
  const name = params.name.trim()
  if (!name) throw new Error('Topic name is required')

  const ref = await addDoc(collection(db, 'topics'), {
    user_id: params.userId,
    name,
    form_type: FormType.IT,
    is_active: true,
    sort_order: params.sortOrder,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  })

  return {
    id: ref.id,
    name,
    sort_order: params.sortOrder,
    is_active: true,
  }
}

/** 無効な Topic を再利用する前に明示的に有効化する。 */
export async function reactivateTopic(topicId: string): Promise<void> {
  await updateDoc(doc(db, 'topics', topicId), {
    is_active: true,
    updated_at: serverTimestamp(),
  })
}
