'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/Badge'
import { FieldWrapper } from '@/components/ui/FormField'

// Component con mỗi item có thể kéo thả
function SortableBadge({ id, label, onRemove }: { id: string; label: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <Badge variant="neutral" onRemove={onRemove}>{label}</Badge>
    </div>
  )
}

interface CollocationEditorProps {
  items: string[]
  onChange: (items: string[]) => void
}

export function CollocationEditor({ items, onChange }: CollocationEditorProps) {
  const [inputValue, setInputValue] = useState('')

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string)
      const newIndex = items.indexOf(over.id as string)
      onChange(arrayMove(items, oldIndex, newIndex))
    }
  }

  const addItem = () => {
    const trimmed = inputValue.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
    }
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addItem()
    }
  }

  const removeItem = (item: string) => onChange(items.filter(i => i !== item))

  return (
    <FieldWrapper label="Collocations">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-2 mb-3 min-h-8">
            {items.map(item => (
              <SortableBadge key={item} id={item} label={item} onRemove={() => removeItem(item)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={addItem}
        placeholder="Type and press Enter to add..."
        className="w-full text-sm bg-surface-low border border-outline-var rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 text-on-surface placeholder:text-on-surface-var/60"
      />
    </FieldWrapper>
  )
}
