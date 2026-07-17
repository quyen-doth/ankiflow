'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Plus } from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { FieldWrapper } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { NewTopicModal } from '@/components/create/NewTopicModal'
import { createTopic, normalizeTopicName, reactivateTopic } from '@/lib/create/createTopic'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { Topic } from '@/types'

interface TopicSelectorProps {
  selectedIds: string[]
  selectedNames: string[]
  onChange: (selection: TopicSelection) => void
  onLoadingChange?: (loading: boolean) => void
}

export interface TopicSelection {
  ids: string[]
  names: string[]
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function TopicSelector({
  selectedIds,
  selectedNames,
  onChange,
  onLoadingChange,
}: TopicSelectorProps) {
  const { user, loading: authLoading } = useAuth()
  const toast = useToast()
  const [topics, setTopics] = useState<Pick<Topic, 'id' | 'name' | 'sort_order' | 'is_active'>[]>([])
  const [loading, setLoading] = useState(true)
  const [loadSucceeded, setLoadSucceeded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [reactivateTarget, setReactivateTarget] = useState<Pick<Topic, 'id' | 'name'> | null>(null)
  const [reactivating, setReactivating] = useState(false)

  useEffect(() => {
    if (authLoading || !user) return
    const uid = user.uid
    async function fetchTopics() {
      setLoading(true)
      setLoadSucceeded(false)
      setLoadError(false)
      try {
        const q = query(
          collection(db, 'topics'),
          where('user_id', '==', uid),
          where('form_type', '==', FormType.IT),
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Pick<Topic, 'name' | 'sort_order' | 'is_active'>),
          }))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setTopics(data)
        setLoadSucceeded(true)
      } catch (error) {
        console.error("Error fetching topics", error)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchTopics()
  }, [user, authLoading, refreshKey])

  const retryLoad = () => setRefreshKey(key => key + 1)

  const activeTopics = useMemo(
    () => topics.filter(topic => topic.is_active),
    [topics],
  )

  useEffect(() => {
    if (loading) {
      onLoadingChange?.(true)
      return
    }
    if (!loadSucceeded) {
      onLoadingChange?.(false)
      return
    }

    const resolved = selectedIds
      .map(id => activeTopics.find(topic => topic.id === id))
      .filter((topic): topic is Pick<Topic, 'id' | 'name' | 'sort_order' | 'is_active'> => !!topic)
    const nextSelection = {
      ids: resolved.map(topic => topic.id),
      names: resolved.map(topic => topic.name),
    }

    if (!arraysEqual(selectedIds, nextSelection.ids) || !arraysEqual(selectedNames, nextSelection.names)) {
      onChange(nextSelection)
    }
    onLoadingChange?.(false)
  }, [activeTopics, loadSucceeded, loading, onChange, onLoadingChange, selectedIds, selectedNames])

  const emitSelection = (ids: string[], additionalTopic?: Pick<Topic, 'id' | 'name'>) => {
    const availableTopics = additionalTopic
      ? [...activeTopics.filter(topic => topic.id !== additionalTopic.id), additionalTopic]
      : activeTopics
    const resolved = ids
      .map(id => availableTopics.find(topic => topic.id === id))
      .filter((topic): topic is Pick<Topic, 'id' | 'name'> => !!topic)
    onChange({
      ids: resolved.map(topic => topic.id),
      names: resolved.map(topic => topic.name),
    })
  }

  const toggleTopic = (id: string) => {
    emitSelection(selectedIds.includes(id)
      ? selectedIds.filter(v => v !== id)
      : [...selectedIds, id]
    )
  }

  const selectTopic = (topic: Pick<Topic, 'id' | 'name'>) => {
    if (!selectedIds.includes(topic.id)) emitSelection([...selectedIds, topic.id], topic)
  }

  const handleCreateTopic = async (name: string) => {
    if (!user) throw new Error('Not signed in')

    const normalizedName = normalizeTopicName(name)
    const matchingTopics = topics.filter(topic => normalizeTopicName(topic.name) === normalizedName)
    const existing = matchingTopics.find(topic => topic.is_active) ?? matchingTopics[0]

    if (existing?.is_active) {
      selectTopic(existing)
      toast.info(`Selected existing topic “${existing.name}”`)
      return
    }

    if (existing) {
      setReactivateTarget(existing)
      return
    }

    const nextSortOrder = topics.reduce(
      (maximum, topic) => Math.max(maximum, topic.sort_order || 0),
      0,
    ) + 1
    const created = await createTopic({
      userId: user.uid,
      name,
      sortOrder: nextSortOrder,
    })
    setTopics(current => [...current, created])
    selectTopic(created)
    toast.success(`Created topic “${created.name}”`)
  }

  const handleReactivate = async () => {
    if (!reactivateTarget || reactivating) return

    setReactivating(true)
    try {
      await reactivateTopic(reactivateTarget.id)
      setTopics(current => current.map(topic => (
        topic.id === reactivateTarget.id ? { ...topic, is_active: true } : topic
      )))
      selectTopic(reactivateTarget)
      toast.success(`Reactivated topic “${reactivateTarget.name}”`)
      setReactivateTarget(null)
    } catch (error) {
      console.error('Reactivate topic error:', error)
      toast.error('Failed to reactivate the topic. Please try again.')
    } finally {
      setReactivating(false)
    }
  }

  return (
    <>
      <FieldWrapper
        label="Topics"
        {...verifyAttrs({ unit: 'TopicSelector', count: activeTopics.length, selected: selectedIds.length, loading, error: loadError })}
      >
        {loading ? (
          <span className="text-sm text-slate-600">Loading topics...</span>
        ) : loadError ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-danger">Failed to load topics.</span>
            <Button type="button" variant="ghost" size="sm" onClick={retryLoad}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {activeTopics.map(topic => (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                className="transition-transform active:scale-95"
                data-topic-id={topic.id}
              >
                <Badge variant={selectedIds.includes(topic.id) ? 'active' : 'neutral'} className="px-3 py-1.5">
                  {topic.name}
                </Badge>
              </button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              New topic
            </Button>
          </div>
        )}
      </FieldWrapper>

      <NewTopicModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateTopic}
      />

      <Modal
        open={reactivateTarget !== null}
        onClose={() => { if (!reactivating) setReactivateTarget(null) }}
        title="Reactivate topic?"
        description={reactivateTarget
          ? `A topic named “${reactivateTarget.name}” already exists but is inactive.`
          : undefined}
        size="sm"
      >
        <p className="text-body text-slate-600">
          Reactivate and select this topic instead of creating a duplicate?
        </p>
        <div className="flex gap-3 justify-end mt-5">
          <Button
            variant="ghost"
            onClick={() => setReactivateTarget(null)}
            disabled={reactivating}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleReactivate()}
            loading={reactivating}
          >
            Reactivate topic
          </Button>
        </div>
      </Modal>
    </>
  )
}
