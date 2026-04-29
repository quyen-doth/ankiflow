'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { Badge } from './Badge'
import { Button } from './Button'

interface ActiveFilter {
  key: string
  label: string
}

interface FilterBarProps {
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  filters?: Array<{ label: string; value: string; options: string[] }>
  activeFilters?: ActiveFilter[]
  onRemoveFilter?: (key: string) => void
  onClearAll?: () => void
  onFilterClick?: () => void
}

export function FilterBar({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  activeFilters = [],
  onRemoveFilter,
  onClearAll,
  onFilterClick,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-var" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white border border-outline-var rounded-full pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Filter button */}
        {onFilterClick && (
          <Button
            variant="primary"
            leftIcon={<SlidersHorizontal className="w-4 h-4" />}
            onClick={onFilterClick}
          >
            Filter
          </Button>
        )}
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-label-sm uppercase tracking-wide text-on-surface-var">Applied:</span>
          {activeFilters.map((f) => (
            <Badge key={f.key} variant="active" onRemove={() => onRemoveFilter?.(f.key)}>
              {f.label}
            </Badge>
          ))}
          <button onClick={onClearAll} className="text-xs text-on-surface-var hover:text-error underline transition-colors">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
