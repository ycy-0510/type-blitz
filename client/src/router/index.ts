import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import Room from '../views/Room.vue'
import Competition from '../views/Competition.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/room/:id', component: Room },
    { path: '/play', component: Competition }
  ]
})

export default router
