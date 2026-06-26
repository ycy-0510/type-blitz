import { createRouter, createWebHistory } from 'vue-router'
import Lobby from '../views/Lobby.vue'
import Room from '../views/Room.vue'
import Competition from '../views/Competition.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Lobby },
    { path: '/room/:id', component: Room },
    { path: '/play', component: Competition }
  ]
})

export default router
