import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScrollTimeline from './ScrollTimeline.vue'

describe('ScrollTimeline', () => {
  it('renders progress and labels', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.5, timeLeft: 120 },
    })

    expect(wrapper.find('.tl-meter').exists()).toBe(true)
    expect(wrapper.find('.tl-fill').attributes('style')).toContain('width: 50%')
    expect(wrapper.find('.tl-elapsed').text()).toBe('50%')
    expect(wrapper.find('.tl-time-left').text()).toBe('2m 0s left')
  })

  it('clamps displayed progress', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 1.4, timeLeft: -1 },
    })

    expect(wrapper.find('.tl-fill').attributes('style')).toContain('width: 100%')
    expect(wrapper.find('.tl-elapsed').text()).toBe('100%')
    expect(wrapper.find('.tl-meter').attributes('aria-valuenow')).toBe('100')
    expect(wrapper.find('.tl-time-left').exists()).toBe(false)
  })

  it('formats time left in seconds', () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.5, timeLeft: 45 },
    })

    expect(wrapper.find('.tl-time-left').text()).toBe('45s left')
  })

  it('emits fixed navigation commands from buttons', async () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.5, timeLeft: 30 },
    })

    const buttons = wrapper.findAll('.tl-btn')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')

    expect(wrapper.emitted('step')).toEqual([[-1], [1]])
    expect(wrapper.emitted('reset')).toEqual([[]])
  })

  it('does not emit navigation when the meter is touched or clicked', async () => {
    const wrapper = mount(ScrollTimeline, {
      props: { progress: 0.5, timeLeft: 30 },
    })

    await wrapper.find('.tl-meter').trigger('click')
    wrapper.find('.tl-meter').element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }))
    wrapper.find('.tl-meter').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

    expect(wrapper.emitted('step')).toBeUndefined()
    expect(wrapper.emitted('reset')).toBeUndefined()
  })

  it('disables unavailable navigation buttons at the bounds', () => {
    const startWrapper = mount(ScrollTimeline, {
      props: { progress: 0, timeLeft: 60 },
    })
    const startButtons = startWrapper.findAll('.tl-btn')
    expect(startButtons[0].attributes('disabled')).toBeDefined()
    expect(startButtons[1].attributes('disabled')).toBeDefined()
    expect(startButtons[2].attributes('disabled')).toBeUndefined()

    const endWrapper = mount(ScrollTimeline, {
      props: { progress: 1, timeLeft: 0 },
    })
    const endButtons = endWrapper.findAll('.tl-btn')
    expect(endButtons[0].attributes('disabled')).toBeUndefined()
    expect(endButtons[1].attributes('disabled')).toBeUndefined()
    expect(endButtons[2].attributes('disabled')).toBeDefined()
  })
})
