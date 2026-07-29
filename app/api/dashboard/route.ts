import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { apiError, apiSuccess, catchError } from '@/lib/api-response'
import {
  loadDashboard,
  parseDashboardQueryParams,
} from '@/lib/dashboard/dashboardQuery'

export const GET = withAuth(async (request, _context, uid) => {
  const parsed = parseDashboardQueryParams(new URL(request.url))
  if (!parsed.success) return apiError('Invalid query parameters', 400)

  try {
    return apiSuccess(await loadDashboard(getAdminDb(), uid, parsed.data))
  } catch (error) {
    console.error('Fetch Dashboard Error:', error)
    return catchError(error)
  }
})
