import Vue from 'vue'
import Router from 'vue-router'
// import HelloWorld from '@/components/HelloWorld'
import KLine from '@/components/K-line'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'k-line',
      component: KLine
    }
  ]
})
