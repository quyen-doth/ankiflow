import type { ComponentProps } from 'react'
import { z } from 'zod'
import { ImageSelector } from '@/components/preview/ImageSelector'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type ImageSelectorProps = ComponentProps<typeof ImageSelector>
type UnsplashImage = ImageSelectorProps['images'][number]

function makeImage(id: string, alt: string): UnsplashImage {
  return {
    id,
    urls: {
      small: `https://images.unsplash.com/${id}?w=200`,
      regular: `https://images.unsplash.com/${id}?w=800`,
    },
    alt_description: alt,
    user: { name: 'Photographer', links: { html: 'https://unsplash.com/@photographer' } },
  }
}

const IMAGES = [
  makeImage('img-1', 'a cup of coffee'),
  makeImage('img-2', 'mountain at sunrise'),
  makeImage('img-3', 'open book on desk'),
  makeImage('img-4', 'city street at night'),
]

// Spies — reset trong act
const selectSpy = { count: 0, lastId: null as string | null }
const recordSelect = (img: UnsplashImage) => {
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
  description: 'Lưới 4 ảnh Unsplash chọn được + nút Find more + skeleton khi loading.',
  kind: 'component',
  render: props => <ImageSelector {...props} />,
  propsSchema: z.object({
    images: z.array(z.looseObject({ id: z.string() })),
    selectedId: z.string().nullable(),
    onSelect: fn<(img: UnsplashImage) => void>(),
    onRefetch: fn<() => void>(),
    loading: z.boolean().optional(),
  }),
  fixtures: [
    {
      id: 'with-images',
      description: '4 ảnh, chưa chọn — không có dòng credit.',
      props: { images: IMAGES, selectedId: null, onSelect: noop, onRefetch: noop },
    },
    {
      id: 'with-selection',
      description: 'Đã chọn 1 ảnh — hiện dòng credit Unsplash.',
      props: { images: IMAGES, selectedId: 'img-2', onSelect: noop, onRefetch: noop },
    },
    {
      id: 'loading',
      description: 'Đang loading — 4 skeleton, nút hiển thị Searching... và disabled.',
      props: { images: [], selectedId: null, onSelect: noop, onRefetch: noop, loading: true },
    },
    {
      id: 'act-select',
      description: 'Act: click ảnh đầu → onSelect nhận đúng image object.',
      props: { images: IMAGES, selectedId: null, onSelect: recordSelect, onRefetch: noop },
      act: async ctx => {
        selectSpy.count = 0
        selectSpy.lastId = null
        await ctx.click('[aria-label="Select image: a cup of coffee"]')
      },
    },
    {
      id: 'act-refetch',
      description: 'Act: click Find more → onRefetch gọi 1 lần.',
      props: { images: IMAGES, selectedId: null, onSelect: noop, onRefetch: recordRefetch },
      act: async ctx => {
        refetchSpy.count = 0
        const btn = Array.from(ctx.root.querySelectorAll('button')).find(b =>
          b.textContent?.includes('Find more')
        )
        if (!btn) throw new Error('không tìm thấy nút Find more')
        btn.click()
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-empty-images',
      probe: true,
      description: 'Probe: images rỗng — lưới trống, không crash, không credit.',
      props: { images: [], selectedId: null, onSelect: noop, onRefetch: noop },
    },
  ],
  invariants: [
    {
      id: 'image-button-count',
      description: 'Số nút ảnh = min(images.length, 4) khi không loading',
      check: ({ root, props }) => {
        if (props.loading) return true
        const buttons = root.querySelectorAll('[aria-label^="Select image:"]').length
        const expected = Math.min(props.images.length, 4)
        return buttons === expected || `buttons=${buttons}, expected=${expected}`
      },
    },
    {
      id: 'credit-iff-selected',
      description: 'Dòng credit Unsplash hiện khi và chỉ khi có selectedId',
      check: ({ root, props }) => {
        const hasCredit = (root.textContent ?? '').includes('Photo from')
        const expected = props.selectedId !== null
        return hasCredit === expected || `credit=${hasCredit}, expected=${expected}`
      },
    },
    {
      id: 'loading-state',
      description: 'Loading: không có nút ảnh, text "Searching...", nút refetch disabled',
      onlyFixtures: ['loading'],
      check: ({ root }) => {
        if (root.querySelectorAll('[aria-label^="Select image:"]').length > 0) {
          return 'vẫn còn nút ảnh khi loading'
        }
        if (!(root.textContent ?? '').includes('Searching...')) return 'không thấy "Searching..."'
        const btn = root.querySelector<HTMLButtonElement>('button')
        return btn?.disabled === true || 'nút refetch không disabled'
      },
    },
    {
      id: 'select-fires-image',
      description: 'Click ảnh: onSelect nhận đúng image, gọi 1 lần',
      onlyFixtures: ['act-select'],
      check: () =>
        (selectSpy.count === 1 && selectSpy.lastId === 'img-1') ||
        `count=${selectSpy.count}, lastId=${selectSpy.lastId}`,
    },
    {
      id: 'refetch-fires',
      description: 'Click Find more: onRefetch gọi 1 lần',
      onlyFixtures: ['act-refetch'],
      check: () => refetchSpy.count === 1 || `count=${refetchSpy.count}`,
    },
  ],
})
