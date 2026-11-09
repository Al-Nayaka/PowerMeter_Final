import type { DashboardPage } from './types.ts'

export function pageFromHash(hash: string): DashboardPage {
  const page = hash.replace(/^#/, '')
  return page === 'comparison' || page === 'reports' || page === 'settings'
    ? page
    : 'live'
}

export function pageHash(page: DashboardPage): string {
  return page === 'live' ? '' : `#${page}`
}
