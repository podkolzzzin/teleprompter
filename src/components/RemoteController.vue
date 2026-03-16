<template>
  <div class="remote-root">
    <!-- Connecting state -->
    <div v-if="connecting" class="remote-status">
      <div class="status-icon">📡</div>
      <p class="status-text">Connecting to teleprompter…</p>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="remote-status">
      <div class="status-icon">⚠️</div>
      <p class="status-text">{{ error }}</p>
      <button class="retry-btn" @click="retryConnect">Retry</button>
    </div>

    <!-- Connected: show controls -->
    <div v-else-if="connected" class="remote-controls">
      <div class="remote-header">
        <div class="connection-badge">● Connected</div>
      </div>

      <!-- Play / Pause -->
      <button class="remote-btn play-btn" @click="send({ type: 'togglePlay' })">
        {{ state.playing ? '⏸ Pause' : '▶ Play' }}
      </button>

      <!-- Scroll nudge -->
      <div class="control-row scroll-row">
        <span class="control-label">Scroll</span>
        <button class="remote-btn small-btn" @click="send({ type: 'scrollUp' })" title="Scroll up">↑</button>
        <button class="remote-btn small-btn" @click="send({ type: 'scrollDown' })" title="Scroll down">↓</button>
      </div>

      <!-- Speed -->
      <div class="control-row">
        <span class="control-label">Speed</span>
        <button class="remote-btn small-btn" @click="send({ type: 'speedDown' })">−</button>
        <span class="control-value">{{ state.speed }}</span>
        <button class="remote-btn small-btn" @click="send({ type: 'speedUp' })">+</button>
      </div>

      <!-- Font Size -->
      <div class="control-row">
        <span class="control-label">Size</span>
        <button class="remote-btn small-btn" @click="send({ type: 'fontDown' })">−</button>
        <span class="control-value">{{ state.fontSize }}px</span>
        <button class="remote-btn small-btn" @click="send({ type: 'fontUp' })">+</button>
      </div>

      <!-- Mirror -->
      <button
        class="remote-btn mirror-btn"
        :class="{ active: state.mirror }"
        @click="send({ type: 'toggleMirror' })"
      >
        ↔ Mirror {{ state.mirror ? 'ON' : 'OFF' }}
      </button>

      <!-- Reset -->
      <button class="remote-btn reset-btn" @click="send({ type: 'reset' })">
        ↺ Reset to Top
      </button>
    </div>

    <!-- Fallback: not connected yet -->
    <div v-else class="remote-status">
      <div class="status-icon">📱</div>
      <p class="status-text">Initializing remote control…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useRemoteClient } from '../composables/useRemoteControl'

const route = useRoute()
const { state, connected, connecting, error, connect, send } = useRemoteClient()

function retryConnect() {
  const hostId = route.params.peerId as string
  if (hostId) connect(hostId)
}

onMounted(() => {
  const hostId = route.params.peerId as string
  if (hostId) connect(hostId)
})
</script>

<style scoped>
.remote-root {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--bg, #111);
  color: var(--text, #f0f0f0);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.remote-status {
  text-align: center;
}

.status-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.status-text {
  font-size: 18px;
  color: var(--text-muted, #999);
  margin: 0 0 16px;
}

.retry-btn {
  background: var(--accent, #4ade80);
  color: #111;
  border: none;
  border-radius: 8px;
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.remote-controls {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.remote-header {
  text-align: center;
  margin-bottom: 8px;
}

.connection-badge {
  display: inline-block;
  color: var(--accent, #4ade80);
  font-size: 14px;
  font-weight: 600;
}

.remote-btn {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text, #f0f0f0);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 16px;
  font-size: 20px;
  cursor: pointer;
  transition: background 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.remote-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

.play-btn {
  background: var(--accent, #4ade80);
  color: #111;
  border: none;
  font-weight: 700;
  font-size: 24px;
  padding: 20px;
}

.play-btn:active {
  background: #22c55e;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-label {
  font-size: 14px;
  color: var(--text-muted, #999);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 50px;
  flex-shrink: 0;
}

.control-value {
  flex: 1;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
}

.scroll-row {
  justify-content: center;
  gap: 16px;
}

.scroll-row .small-btn {
  flex: 1;
  border-radius: 12px;
  max-width: 120px;
}

.small-btn {
  width: 56px;
  height: 56px;
  font-size: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;
}

.mirror-btn.active {
  background: rgba(74, 222, 128, 0.2);
  border-color: var(--accent, #4ade80);
  color: var(--accent, #4ade80);
}

.reset-btn {
  font-size: 16px;
  padding: 14px;
}
</style>
