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
import { Plus, X } from 'lucide-react'
import { parseColloc } from '@/lib/collocation'
import { verifyAttrs } from '@/verify/core/contract'

function SortableChip({ id, onRemove }: { id: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const { term, gloss } = parseColloc(id)
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="inline-flex items-center gap-1.5 bg-[#fcfcfb] border border-[#e3e3de] rounded-[8px] px-[11px] py-1.5 text-[13px] font-medium text-ink cursor-grab active:cursor-grabbing"
    >
      <span {...attributes} {...listeners}>{term}</span>
      {gloss && <span className="text-slate-400" {...attributes} {...listeners}>{gloss}</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${term}`}
        className="text-slate-400 hover:text-danger ml-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

interface CollocationEditorProps {
  items: string[]
  onChange: (items: string[]) => void
}

export function CollocationEditor({ items, onChange }: CollocationEditorProps) {
  const [adding, setAdding] = useState(false)
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
    if (trimmed && !items.includes(trimmed)) onChange([...items, trimmed])
    setInputValue('')
    setAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem()
    } else if (e.key === 'Escape') {
      setInputValue('')
      setAdding(false)
    }
  }

  const removeItem = (item: string) => onChange(items.filter(i => i !== item))

  return (
    <div {...verifyAttrs({ unit: 'CollocationEditor', count: items.length })}>
      <p className="text-[11px] font-bold tracking-[0.05em] uppercase font-mono text-slate-400 mb-2.5">
        Collocations
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap items-center gap-2">
            {items.map(item => (
              <SortableChip key={item} id={item} onRemove={() => removeItem(item)} />
            ))}
            {adding ? (
              <input
                type="text"
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addItem}
                placeholder="term (nghĩa)…"
                aria-label="Add collocation"
                className="text-[13px] bg-[#fcfcfb] border border-[#e3e3de] rounded-[8px] px-[11px] py-1.5 focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary-bg text-ink placeholder:text-slate-400/70 w-44"
              />
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1.5 border border-dashed border-[#d3d3ce] text-slate-400 hover:text-ink hover:border-slate-400 rounded-[8px] px-[11px] py-1.5 text-[13px] font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
