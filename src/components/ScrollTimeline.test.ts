import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScrollTimeline from './ScrollTimeline.vue'

describe('ScrollTimeline', () => {
  it('renders the bar and labels', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.5, timeLeft: 120 },
    })
    expect(wrapper.find('.tl-bar').exists()).toBe(true)
    expect(wrapper.find('.tl-fill').exists()).toBe(true)
    expect(wrapper.find('.tl-labels').exists()).toBe(true)
  })

  it('shows correct elapsed percentage', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.42, timeLeft: 30 },
    })
    expect(wrapper.find('.tl-elapsed').text()).toBe('42%')
  })

  it('shows 0% at start', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0, timeLeft: 60 },
    })
    expect(wrapper.find('.tl-elapsed').text()).toBe('0%')
  })

  it('shows 100% at end', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 1, timeLeft: 0 },
    })
    expect(wrapper.find('.tl-elapsed').text()).toBe('100%')
  })

  it('formats time left in seconds', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.5, timeLeft: 45 },
    })
    expect(wrapper.find('.tl-time-left').text()).toBe('45s left')
  })

  it('formats time left in minutes and seconds', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.1, timeLeft: 130 },
    })
    expect(wrapper.find('.tl-time-left').text()).toBe('2m 10s left')
  })

  it('hides time-left label when timeLeft is negative', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.3, timeLeft: -1 },
    })
    expect(wrapper.find('.tl-time-left').exists()).toBe(false)
  })

  it('sets fill width matching progress', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.75, timeLeft: 20 },
    })
    const fill = wrapper.find('.tl-fill')
    expect(fill.attributes('style')).toContain('width: 75%')
  })

  it('emits seek event with correct progress on pointerdown', async () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0, timeLeft: 60 },
      attachTo: document.body,
    })

    const bar = wrapper.find('.tl-bar')
    // Mock getBoundingClientRect to return a 200px wide bar at x=0
    ;(bar.element as HTMLElement).getBoundingClientRect = () => ({
      left: 0, right: 200, width: 200, top: 0, bottom: 20, height: 20,
      x: 0, y: 0, toJSON: () => {},
    })

    bar.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('seek')).toBeTruthy()
    expect(wrapper.emitted('seek')![0]).toEqual([0.5])

    wrapper.unmount()
  })

  it('emits seek = 0 when clicking at far left', async () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.5, timeLeft: 30 },
      attachTo: document.body,
    })

    const bar = wrapper.find('.tl-bar')
    ;(bar.element as HTMLElement).getBoundingClientRect = () => ({
      left: 50, right: 250, width: 200, top: 0, bottom: 20, height: 20,
      x: 50, y: 0, toJSON: () => {},
    })

    bar.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('seek')![0]).toEqual([0])

    wrapper.unmount()
  })

  it('clamps seek to 1 when clicking beyond right edge', async () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.5, timeLeft: 30 },
      attachTo: document.body,
    })

    const bar = wrapper.find('.tl-bar')
    ;(bar.element as HTMLElement).getBoundingClientRect = () => ({
      left: 0, right: 200, width: 200, top: 0, bottom: 20, height: 20,
      x: 0, y: 0, toJSON: () => {},
    })

    bar.element.dispatchEvent(new PointerEvent('pointerdown', { clientX: 300, bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('seek')![0]).toEqual([1])

    wrapper.unmount()
  })
})
