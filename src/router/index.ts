import { createRouter, createWebHistory } from 'vue-router'
import ScriptList from '../components/ScriptList.vue'
import ScriptEditor from '../components/ScriptEditor.vue'
import TeleprompterView from '../components/TeleprompterView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: ScriptList },
    { path: '/edit/:id?', component: ScriptEditor },
    { path: '/teleprompter/:id', component: TeleprompterView },
  ]
})

export default router
