<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  url: string
  status: 'idle' | 'waiting' | 'connected' | 'error'
  errorMessage?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const qrDataUrl = ref('')
const copied = ref(false)

async function generateQr(url: string) {
  if (!url) return
  qrDataUrl.value = await QRCode.toDataURL(url, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

onMounted(() => generateQr(props.url))
watch(() => props.url, generateQr)

async function copyLink() {
  if (!props.url) return
  await navigator.clipboard.writeText(props.url)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <button class="modal-close" @click="emit('close')" title="Close">✕</button>

      <slot name="title" />

      <div class="qr-wrapper">
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR Code" class="qr-img" />
        <div v-else class="qr-skeleton">Generating QR…</div>
      </div>

      <p class="url-label">Or copy the link:</p>
      <div class="url-row">
        <input class="url-input" :value="url" readonly aria-label="Share link" />
        <button class="btn-copy" @click="copyLink">{{ copied ? '✓ Copied' : 'Copy' }}</button>
      </div>

      <div
        class="status-banner"
        :class="{
          'status-waiting': status === 'waiting',
          'status-connected': status === 'connected',
          'status-error': status === 'error',
        }"
      >
        <template v-if="status === 'waiting'">⏳ Waiting for the other device to connect…</template>
        <template v-else-if="status === 'connected'">✅ Connected! Sending data…</template>
        <template v-else-if="status === 'error'">❌ Error: {{ errorMessage }}</template>
        <template v-else>Initialising…</template>
      </div>

      <slot />
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px 24px 24px;
  width: 100%;
  max-width: 380px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  padding: 4px 8px;
  line-height: 1;
}

.modal-close:hover {
  color: var(--text);
}

.qr-wrapper {
  display: flex;
  justify-content: center;
}

.qr-img {
  border-radius: 8px;
  width: 200px;
  height: 200px;
}

.qr-skeleton {
  width: 200px;
  height: 200px;
  background: var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}

.url-label {
  font-size: 13px;
  color: var(--text-muted);
}

.url-row {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 12px;
  padding: 8px 10px;
  min-width: 0;
}

.btn-copy {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 13px;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-banner {
  padding: 10px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  text-align: center;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.status-waiting {
  background: rgba(74, 222, 128, 0.08);
  color: var(--accent);
}

.status-connected {
  background: rgba(74, 222, 128, 0.15);
  color: var(--accent);
}

.status-error {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
}
</style>
