<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { saveScript } from '../storage/db'
import { useShareClient, type TransferPayload } from '../composables/useRemoteControl'

const route = useRoute()
const router = useRouter()
const { status, error, connect, onData } = useShareClient()

const imported = ref(0)
const total = ref(0)
const done = ref(false)

onMounted(async () => {
  const peerId = route.params.peerId as string
  if (!peerId) {
    router.push('/')
    return
  }

  onData(async (payload) => {
    if (payload.type === 'transfer') {
      await handleTransfer(payload)
    }
  })

  try {
    await connect(peerId)
  } catch {
    // error is reactive in the composable
  }
})

async function handleTransfer(payload: TransferPayload) {
  total.value = payload.scripts.length
  imported.value = 0
  for (const script of payload.scripts) {
    await saveScript(script)
    imported.value++
  }
  done.value = true
}
</script>

<template>
  <div class="page">
    <header class="header">
      <h1 class="logo">📺 Teleprompter</h1>
    </header>

    <main class="content">
      <div class="state-box">
        <!-- Success -->
        <template v-if="done">
          <p class="state-icon">🎉</p>
          <p class="state-title">Transfer complete!</p>
          <p class="state-sub">{{ imported }} script{{ imported !== 1 ? 's' : '' }} imported successfully.</p>
          <button class="btn-accent" @click="router.push('/')">View Scripts</button>
        </template>

        <!-- In progress -->
        <template v-else-if="status === 'connected' && total > 0">
          <p class="state-icon">📥</p>
          <p class="state-title">Importing scripts…</p>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: (imported / total) * 100 + '%' }"></div>
          </div>
          <p class="state-sub">{{ imported }} / {{ total }}</p>
        </template>

        <!-- Error -->
        <template v-else-if="status === 'error'">
          <p class="state-icon">❌</p>
          <p class="state-title">Connection failed</p>
          <p class="state-sub">{{ error }}</p>
          <button class="btn-back" @click="router.push('/')">← Back</button>
        </template>

        <!-- Connected, waiting for data -->
        <template v-else-if="status === 'connected'">
          <p class="state-icon">⏳</p>
          <p class="state-title">Waiting for scripts…</p>
          <p class="state-sub">Connected to the sender. Data will arrive shortly.</p>
        </template>

        <!-- Connecting -->
        <template v-else>
          <p class="state-icon">🔗</p>
          <p class="state-title">Connecting…</p>
          <p class="state-sub">Please keep the sender's device open.</p>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.logo {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.5px;
}

.content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
  max-width: 360px;
}

.state-icon {
  font-size: 52px;
}

.state-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
}

.state-sub {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.progress-bar {
  width: 240px;
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.2s;
}

.btn-accent {
  background: var(--accent);
  color: #111;
  font-weight: 600;
  margin-top: 8px;
}

.btn-back {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  margin-top: 8px;
}
</style>
