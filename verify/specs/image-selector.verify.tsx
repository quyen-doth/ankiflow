import type { ComponentProps } from 'react'
import { z } from 'zod'
import { ImageSelector } from '@/components/preview/ImageSelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type ImageSelectorProps = ComponentProps<typeof ImageSelector>
type ImageItem = ImageSelectorProps['images'][number]

function makeImage(id: string, creditName: string): ImageItem {
  return {
    id,
    url: `https://images.unsplash.com/${id}?w=800`,
    thumb: `https://images.unsplash.com/${id}?w=200`,
    credit_name: creditName,
    credit_url: `https://unsplash.com/@${creditName.toLowerCase().replace(/\s/g, '')}`,
  }
}

const IMAGES = [
  makeImage('img-1', 'Alice'),
  makeImage('img-2', 'Bob'),
  makeImage('img-3', 'Charlie'),
  makeImage('img-4', 'Diana'),
]

const selectSpy = { count: 0, lastId: null as string | null }
const recordSelect = (img: ImageItem) => {
  selectSpy.count++
  selectSpy.lastId = img.id
}
const refetchSpy = { count: 0 }
const recordRefetch = () => {
  refetchSpy.count++
}
const noop = () => undefined

registerUnit<ImageSelectorProps>({
  id: 'ImageSelector',
  title: 'ImageSelector',
  description: '検証ケース。',
  kind: 'component',
  render: props => <ImageSelector {...props} />,
  propsSchema: z.object({
    images: z.array(z.looseObject({ id: z.string() })),
    selectedUrl: z.string().nullable(),
    onSelect: fn<(img: ImageItem) => void>(),
    onRefetch: fn<() => void>(),
    onUpload: fn<(dataUrl: string) => void>(),
    loading: z.boolean().optional(),
  }),
  fixtures: [
    {
      id: 'with-images',
      description: '検証ケース。',
      props: { images: IMAGES, selectedUrl: null, onSelect: noop, onRefetch: noop, onUpload: noop },
    },
    {
      id: 'with-selection',
      description: '検証ケース。',
      props: { images: IMAGES, selectedUrl: IMAGES[1].url, onSelect: noop, onRefetch: noop, onUpload: noop },
    },
    {
      id: 'loading',
      description: '検証ケース。',
      props: { images: [], selectedUrl: null, onSelect: noop, onRefetch: noop, onUpload: noop, loading: true },
    },
    {
      id: 'act-select',
      description: '検証ケース。',
      props: { images: IMAGES, selectedUrl: null, onSelect: recordSelect, onRefetch: noop, onUpload: noop },
      act: async ctx => {
        selectSpy.count = 0
        selectSpy.lastId = null
        await ctx.click('[aria-label="Select image: Alice"]')
      },
    },
    {
      id: 'act-refetch',
      description: '検証ケース。',
      props: { images: IMAGES, selectedUrl: null, onSelect: noop, onRefetch: recordRefetch, onUpload: noop },
      act: async ctx => {
        refetchSpy.count = 0
        const btn = Array.from(ctx.root.querySelectorAll('button')).find(b =>
          b.textContent?.includes('Find more')
        )
        if (!btn) throw new Error('要素が見つかりません')
        btn.click()
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-empty-images',
      probe: true,
      description: '検証ケース。',
      props: { images: [], selectedUrl: null, onSelect: noop, onRefetch: noop, onUpload: noop },
    },
  ],
  invariants: [
    {
      id: 'image-button-count',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (props.loading) return true
        const buttons = root.querySelectorAll('[aria-label^="Select image:"]').length
        const expected = Math.min(props.images.length, 4)
        return buttons === expected || `buttons=${buttons}, expected=${expected}`
      },
    },
    {
      id: 'credit-iff-selected',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const hasCredit = (root.textContent ?? '').includes('Unsplash')
        const expected = props.selectedUrl !== null && props.images.some(img => img.url === props.selectedUrl)
        return hasCredit === expected || `credit=${hasCredit}, expected=${expected}`
      },
    },
    {
      id: 'loading-state',
      description: 'Loading: image ボタンはなく、text は "Searching..."、refetch ボタンは disabled',
      onlyFixtures: ['loading'],
      check: ({ root }) => {
        if (root.querySelectorAll('[aria-label^="Select image:"]').length > 0) {
          return 'loading 中でも image button がまだ残っています'
        }
        if (!(root.textContent ?? '').includes('Searching...')) return '見つかりません "Searching..."'
        return true
      },
    },
    {
      id: 'select-fires-image',
      description: '検証ケース。',
      onlyFixtures: ['act-select'],
      check: () =>
        (selectSpy.count === 1 && selectSpy.lastId === 'img-1') ||
        `count=${selectSpy.count}, lastId=${selectSpy.lastId}`,
    },
    {
      id: 'refetch-fires',
      description: '検証ケース。',
      onlyFixtures: ['act-refetch'],
      check: () => refetchSpy.count === 1 || `count=${refetchSpy.count}`,
    },
  ],
})
