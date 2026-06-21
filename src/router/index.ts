import { createRouter, createWebHistory } from 'vue-router'
import ScriptList from '../components/ScriptList.vue'
import ScriptEditor from '../components/ScriptEditor.vue'
import TeleprompterView from '../components/TeleprompterView.vue'
import RemoteController from '../components/RemoteController.vue'
import AccountConnector from '../components/AccountConnector.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: ScriptList },
    { path: '/edit/:id?', component: ScriptEditor },
    { path: '/teleprompter/:id', component: TeleprompterView },
    { path: '/remote/:peerId', component: RemoteController },
    { path: '/account/:deviceId', component: AccountConnector },
  ]
})

export default router
