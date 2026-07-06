import { describe, expect, it } from 'vitest'
import { extractMedia } from '@/lib/anki/extractMedia'

describe('extractMedia', () => {
  it('trích audio từ [sound:...]', () => {
    expect(extractMedia('meaning [sound:ankiflow_hello.mp3]')).toEqual({
      audioFilename: 'ankiflow_hello.mp3',
    })
  })

  it('trích ảnh media Anki (tên file trần)', () => {
    const html = '<div class="media"><img src="ankiflow_img_hello.png" alt=""></div>'
    expect(extractMedia(html)).toEqual({ imageFilename: 'ankiflow_img_hello.png' })
  })

  it('bỏ qua ảnh URL http (để buildNotes tự nhúng lại từ image_url)', () => {
    const html = '<img src="https://images.unsplash.com/photo-x">'
    expect(extractMedia(html)).toEqual({})
  })

  it('bỏ qua ảnh data URL', () => {
    expect(extractMedia('<img src="data:image/png;base64,AAAA">')).toEqual({})
  })

  it('lấy cả audio lẫn ảnh trong cùng HTML', () => {
    const html = '<img src="ankiflow_img_x.jpg"> word [sound:ankiflow_x.mp3]'
    expect(extractMedia(html)).toEqual({
      audioFilename: 'ankiflow_x.mp3',
      imageFilename: 'ankiflow_img_x.jpg',
    })
  })

  it('không có media → object rỗng', () => {
    expect(extractMedia('<div class="word">hello</div>')).toEqual({})
  })
})
