import compose from './compose'

/**
 * 创建一个应用所有中间件的增强器，所有的 dispatch action 会先经过先中间件处理。
 *
 * `redux-thunk` 查看案例
 *
 * 如果中间件可能是异步的，那它应该是第一个被执行的
 *
 * 每个中间件调用都会传入 getState 和 dispatch 方法
 *
 * @param {...Function} 所有要应用的中间件
 * @returns {Function} 应用中间件之后的 store
 */
export default function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState, enhancer) => {
    var store = createStore(reducer, preloadedState, enhancer)
    var dispatch = store.dispatch
    var chain = [] // 中间件链

    var middlewareAPI = {
      getState: store.getState,
      dispatch: (action) => dispatch(action)
    }
    // 给所有中间件的执行传入 getState 和 dispatch
    chain = middlewares.map(middleware => middleware(middlewareAPI))
    dispatch = compose(...chain)(store.dispatch)

    return {
      ...store,
      dispatch
    }
  }
}
