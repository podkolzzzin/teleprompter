import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ShareModal from './ShareModal.vue'

// Mock qrcode
vi.mock('qrcode', () => ({
  default: {
    toCanvas: vi.fn(),
  },
}))

describe('ShareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders share URL in input', () => {
    const wrapper = mount(ShareModal, {
      props: {
        shareUrl: 'https://example.com/remote/abc123',
        connected: false,
      },
    })

    const input = wrapper.find('.share-link-input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('https://example.com/remote/abc123')
  })

  it('shows waiting status when not connected', () => {
    const wrapper = mount(ShareModal, {
      props: {
        shareUrl: 'https://example.com/remote/abc123',
        connected: false,
      },
    })

    expect(wrapper.find('.share-status.waiting').exists()).toBe(true)
    expect(wrapper.text()).toContain('Waiting for connection')
  })

  it('shows connected status when connected', () => {
    const wrapper = mount(ShareModal, {
      props: {
        shareUrl: 'https://example.com/remote/abc123',
        connected: true,
      },
    })

    expect(wrapper.find('.share-status.connected').exists()).toBe(true)
    expect(wrapper.text()).toContain('Remote connected')
  })

  it('emits close when close button clicked', async () => {
    const wrapper = mount(ShareModal, {
      props: {
        shareUrl: 'https://example.com/remote/abc123',
        connected: false,
      },
    })

    await wrapper.find('.share-close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when backdrop clicked', async () => {
    const wrapper = mount(ShareModal, {
      props: {
        shareUrl: 'https://example.com/remote/abc123',
        connected: false,
      },
    })

    await wrapper.find('.share-backdrop').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('renders QR code canvas', () => {
    const wrapper = mount(ShareModal, {
      props: {
        shareUrl: 'https://example.com/remote/abc123',
        connected: false,
      },
    })

    expect(wrapper.find('.qr-container canvas').exists()).toBe(true)
  })
})
