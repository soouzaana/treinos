import { createRouter, createWebHashHistory } from 'vue-router'

/**
 * Hash history: funciona em qualquer hospedagem estática (GitHub Pages, Netlify, Vercel)
 * sem regras de reescrita, inclusive offline e ao atualizar a página em qualquer rota.
 */
export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'hoje', component: () => import('@/pages/TodayPage.vue'), meta: { title: 'Hoje' } },
    { path: '/sessao/:date/:modalityId', name: 'sessao', component: () => import('@/pages/SessionPage.vue'), meta: { title: 'Treino', focus: true } },
    { path: '/planejamento', name: 'planejamento', component: () => import('@/pages/PlanPage.vue'), meta: { title: 'Planejamento' } },
    { path: '/treinos', name: 'treinos', component: () => import('@/pages/WorkoutsPage.vue'), meta: { title: 'Treinos' } },
    { path: '/treinos/:modalityId', name: 'modalidade', component: () => import('@/pages/ModalityPage.vue'), meta: { title: 'Modalidade' } },
    { path: '/treinos/:modalityId/:workoutId', name: 'treino', component: () => import('@/pages/WorkoutEditorPage.vue'), meta: { title: 'Treino', focus: true } },
    { path: '/desempenho', name: 'desempenho', component: () => import('@/pages/StatsPage.vue'), meta: { title: 'Desempenho' } },
    { path: '/taf', name: 'taf', component: () => import('@/pages/TafPage.vue'), meta: { title: 'TAF' } },
    { path: '/historico', name: 'historico', component: () => import('@/pages/HistoryPage.vue'), meta: { title: 'Histórico' } },
    { path: '/mais', name: 'mais', component: () => import('@/pages/MorePage.vue'), meta: { title: 'Mais' } },
    { path: '/config', name: 'config', component: () => import('@/pages/SettingsPage.vue'), meta: { title: 'Configurações' } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
