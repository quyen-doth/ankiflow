import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { GLOBAL_CONTENT_TYPES_COLLECTION, USER_CONTENT_TYPES_COLLECTION } from '@/lib/constants'
import type { ContentType, UserContentType } from '@/types'

export type UserContentTypeLoader = (uid: string) => Promise<UserContentType[]>

/** 認証済み user の workspace snapshot だけを読み込む。Global fallback は行わない。 */
export const loadUserContentTypes: UserContentTypeLoader = async uid => {
  const snapshot = await getDocs(query(
    collection(db, USER_CONTENT_TYPES_COLLECTION),
    where('user_id', '==', uid),
  ))

  return snapshot.docs.map(document => ({
    id: document.id,
    ...document.data(),
  }) as UserContentType)
}

/** 新規 user 用 card template editor が参照する global Content Type source を読む。 */
export async function loadGlobalContentTypes(): Promise<ContentType[]> {
  const snapshot = await getDocs(collection(db, GLOBAL_CONTENT_TYPES_COLLECTION))
  return snapshot.docs.map(document => ({
    id: document.id,
    ...document.data(),
  }) as ContentType)
}
