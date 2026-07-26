import { withAuth } from '@/lib/auth-guard'
import { getAdminDb } from '@/lib/firebase-admin'
import { apiSuccess, catchError } from '@/lib/api-response'
import { loadHistoryFacets } from '@/lib/history/historyQuery'

export const GET = withAuth(async (_request, _context, uid) => {
  try {
    return apiSuccess(await loadHistoryFacets(getAdminDb(), uid))
  } catch (error) {
    return catchError(error)
  }
})
