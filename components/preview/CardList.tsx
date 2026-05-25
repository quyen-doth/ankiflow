'use client'

import { Toggle } from '@/components/ui/Toggle'
import { FieldWrapper } from '@/components/ui/FormField'

interface CardType {
  id: string
  name: string
  description?: string
}

interface CardListProps {
  cardTypes: CardType[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function CardList({ cardTypes, selectedIds, onChange }: CardListProps) {
  const toggle = (id: string, checked: boolean) => {
    onChange(checked ? [...selectedIds, id] : selectedIds.filter(v => v !== id))
  }

  return (
    <FieldWrapper label="Card Types to Generate">
      <div className="grid grid-cols-2 gap-2">
        {cardTypes.map(ct => (
          <Toggle
            key={ct.id}
            label={ct.name}
            description={ct.description}
            checked={selectedIds.includes(ct.id)}
            onChange={(checked) => toggle(ct.id, checked)}
          />
        ))}
      </div>
    </FieldWrapper>
  )
}
