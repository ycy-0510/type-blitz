import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import TypingArea from '../TypingArea.vue'

// The sound module touches AudioContext; stub it out.
vi.mock('../../sound', () => ({ playSound: vi.fn() }))

async function mountArea(quote: string, language: 'en' | 'zh' = 'en') {
  const wrapper = mount(TypingArea, {
    props: { quote, isActive: true, language },
    attachTo: document.body,
  })
  await nextTick()
  return wrapper
}

function input(wrapper: ReturnType<typeof mount>) {
  return wrapper.find('input').element as HTMLInputElement
}

// Simulate plain (non-IME) typing: append to the box and fire `input`.
async function type(wrapper: ReturnType<typeof mount>, chars: string) {
  const el = input(wrapper)
  for (const ch of chars) {
    el.value += ch
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
}

// Simulate one backspace.
async function backspace(wrapper: ReturnType<typeof mount>) {
  const el = input(wrapper)
  el.value = el.value.slice(0, -1)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

// Simulate an IME session committing `committed` in one shot: composition
// events bracket the box mutation, exactly as browsers do.
async function imeCommit(wrapper: ReturnType<typeof mount>, committed: string) {
  const el = input(wrapper)
  el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  el.value += committed
  el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: committed }))
  await nextTick()
}

function lastProgress(wrapper: ReturnType<typeof mount>) {
  const events = wrapper.emitted('progress')!
  return events[events.length - 1][0] as { correctCount: number; strokes: number }
}

beforeEach(() => { document.body.innerHTML = '' })

describe('English mode', () => {
  it('consumes correct words and finishes', async () => {
    const w = await mountArea('hi there')
    await type(w, 'hi there')
    expect(lastProgress(w).correctCount).toBe(8)
    expect(w.emitted('finish')).toHaveLength(1)
    expect(input(w).value).toBe('') // box cleared after each consumed unit
  })

  it('parks a wrong word and recovers via backspace', async () => {
    const w = await mountArea('cat nap')
    await type(w, 'cax')
    expect(w.text()).toContain('cax') // popover shows the wrong input
    expect(lastProgress(w).correctCount).toBe(0) // incorrect word counts nothing
    await backspace(w)
    await type(w, 't nap')
    expect(w.emitted('finish')).toHaveLength(1)
  })

  it('does not react while inactive', async () => {
    const w = await mountArea('abc')
    await w.setProps({ isActive: false })
    await type(w, 'abc')
    expect(w.emitted('finish')).toBeUndefined()
    expect(input(w).value).toBe('')
  })
})

describe('Chinese mode', () => {
  it('splits into single-character units and consumes an IME commit of several characters', async () => {
    const w = await mountArea('你好嗎', 'zh')
    expect(w.findAll('.unit-current')).toHaveLength(1)
    await imeCommit(w, '你好')
    const p = lastProgress(w)
    expect(p.correctCount).toBe(2)
    expect(p.strokes).toBe(2) // one commit, two characters
    await imeCommit(w, '嗎')
    expect(w.emitted('finish')).toHaveLength(1)
  })

  it('keeps a wrong character in the box for native backspace', async () => {
    const w = await mountArea('大家好', 'zh')
    await imeCommit(w, '大')
    await imeCommit(w, '象') // wrong
    expect(input(w).value).toBe('象')
    expect(lastProgress(w).correctCount).toBe(1)
    await backspace(w)
    await imeCommit(w, '家好')
    expect(w.emitted('finish')).toHaveLength(1)
  })

  it('matches half-width typed punctuation against full-width targets', async () => {
    const w = await mountArea('好，很好。', 'zh')
    await imeCommit(w, '好')
    await type(w, ',') // half-width comma vs ，
    await imeCommit(w, '很好')
    await type(w, '.') // half-width period vs 。
    expect(w.emitted('finish')).toHaveLength(1)
  })

  it('matches full-width IME punctuation too', async () => {
    const w = await mountArea('好，好。', 'zh')
    await imeCommit(w, '好，好。')
    expect(w.emitted('finish')).toHaveLength(1)
  })

  it('ignores input events fired mid-composition', async () => {
    const w = await mountArea('你好', 'zh')
    const el = input(w)
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    el.value = 'ni hao' // uncommitted pinyin/zhuyin garbage
    el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true } as InputEventInit))
    await nextTick()
    // Nothing committed yet — the component must not have emitted any progress.
    expect(w.emitted('progress')).toBeUndefined()
    el.value = '你好'
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }))
    await nextTick()
    expect(w.emitted('finish')).toHaveLength(1)
  })
})
