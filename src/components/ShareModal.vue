<template>
  <div class="share-backdrop" @click.self="$emit('close')">
    <div class="share-modal">
      <h2 class="share-title">Remote Control</h2>
      <p class="share-desc">
        Scan the QR code or open the link on another device to control this teleprompter.
      </p>

      <div class="qr-container">
        <canvas ref="qrCanvas"></canvas>
      </div>

      <div class="share-link-row">
        <input
          class="share-link-input"
          :value="shareUrl"
          readonly
          @focus="($event.target as HTMLInputElement).select()"
        />
        <button class="share-copy-btn" @click="copyLink">
          {{ copied ? '✓' : '📋' }}
        </button>
      </div>

      <div v-if="connected" class="share-status connected">● Remote connected</div>
      <div v-else class="share-status waiting">○ Waiting for connection…</div>

      <button class="share-close-btn" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{
  shareUrl: string
  connected: boolean
}>()

defineEmits<{
  close: []
}>()

const qrCanvas = ref<HTMLCanvasElement | null>(null)
const copied = ref(false)

function renderQR() {
  if (qrCanvas.value && props.shareUrl) {
    QRCode.toCanvas(qrCanvas.value, props.shareUrl, {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
  }
}

onMounted(renderQR)
watch(() => props.shareUrl, renderQR)

function copyLink() {
  navigator.clipboard.writeText(props.shareUrl).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  })
}
</script>

<style scoped>
.share-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.share-modal {
  background: var(--surface, #1e1e1e);
  border: 1px solid var(--border, #333);
  border-radius: 12px;
  padding: 24px;
  max-width: 360px;
  width: 90%;
  text-align: center;
}

.share-title {
  font-size: 20px;
  color: var(--text, #f0f0f0);
  margin: 0 0 8px;
}

.share-desc {
  font-size: 14px;
  color: var(--text-muted, #999);
  margin: 0 0 16px;
  line-height: 1.4;
}

.qr-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.qr-container canvas {
  border-radius: 8px;
}

.share-link-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.share-link-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  color: var(--text, #f0f0f0);
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
  min-width: 0;
}

.share-link-input:focus {
  border-color: var(--accent, #4ade80);
}

.share-copy-btn {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid var(--border, #333);
  border-radius: 6px;
  color: var(--text, #f0f0f0);
  padding: 8px 12px;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
}

.share-copy-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.share-status {
  font-size: 13px;
  margin-bottom: 16px;
}

.share-status.connected {
  color: var(--accent, #4ade80);
}

.share-status.waiting {
  color: var(--text-muted, #999);
}

.share-close-btn {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: var(--text, #f0f0f0);
  padding: 10px 24px;
  font-size: 15px;
  cursor: pointer;
}

.share-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
