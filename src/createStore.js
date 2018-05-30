import isPlainObject from 'lodash/isPlainObject'
import $$observable from 'symbol-observable'

/**
 * Redux私有的Action.
 * 对于所有未知的Action，必须返回该类型
 * 如果当前state为定义，必须返回初始状态
 * 不要在代码中直接引用该类型
 */
export var ActionTypes = {
  INIT: '@@redux/INIT'
}

/**
 * 创建一个store保存 redux 的 state，
 * 只能通过调用 dispatch 方法改变 store 的数据
 *
 * 整个程序应该只有一个 store，如果有多个 state 要响应不同的 Action，可以通过 combineReducers 方法将多个 reducer 合成一个
 *
 * @param {Function} reducer 响应对应的 Action 并返回操作过后的 state
 *
 * @param {any} [preloadedState] Redux 初始的 state，如果使用 combineReducers 合成 reducer， 字段要和 reducer 保存一直
 *
 * @param {Function} 中间件，使用 applyMiddleware 来添加中间件
 *
 * @returns {Store} 返回 store 可以读取 state，也可以通过 dispatch action 和 subscribe 来改变 state
 */
export default function createStore(reducer, preloadedState, enhancer) {
  // 如果只传入了两个参数，并且第二个参数是 function，把第二个参数当成中间件
  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  }

  // 传入了中间件
  if (typeof enhancer !== 'undefined') {
    // 中间件不是方法
    if (typeof enhancer !== 'function') {
      // 报错，必须是方法
      throw new Error('Expected the enhancer to be a function.')
    }

    // 创建 store
    return enhancer(createStore)(reducer, preloadedState)
  }

  // reducer 不是方法
  if (typeof reducer !== 'function') {
    // 抛出错误，必须是方法
    throw new Error('Expected the reducer to be a function.')
  }

  // 只传入了 reducer
  var currentReducer = reducer
  var currentState = preloadedState
  var currentListeners = []
  var nextListeners = currentListeners
  var isDispatching = false

  // 如果下一个监听列表等于当前监听列表，从当前监听列表复制一份
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  /**
   * 读取状态树
   *
   * @returns {any} 当前的状态树
   */
  function getState() {
    // 在 dispatch 中不能获取
    if (isDispatching) {
      throw new Error(
        'You may not call store.getState() while the reducer is executing. ' +
        'The reducer has already received the state as an argument. ' +
        'Pass it down from the top reducer instead of reading it from the store.'
      )
    }

    return currentState
  }

  /**
   * 添加监听器，任何时候的 dispatch action 都会触发监听，可以在基调中通过 getState() 获得当前的 state
   *
   * 你可以通过 dispatch() 方法触发监听
   * 注意事项:
   *
   * 1. subscriptions 在每个 dispatch() 之前都会被临时保存一份，如果在调用监听器的时候订阅和取消订阅
   *    对正在进行的 dispatch() 没有任何影响，然而，下一个 dispatch() 无论是否嵌套，都会使用最新的 subscriptions
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} 监听器每次触发都要调用的回调函数
   * @returns {Function} 删除这个监听器的函数
   */
  function subscribe(listener) {
    // 监听器必须是方法
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.')
    }

    // 在 dispatch 过程中不能触发监听器
    if (isDispatching) {
      throw new Error(
        'You may not call store.subscribe() while the reducer is executing. ' +
        'If you would like to be notified after the store has been updated, subscribe from a ' +
        'component and invoke store.getState() in the callback to access the latest state. ' +
        'See http://redux.js.org/docs/api/Store.html#subscribe for more details.'
      )
    }

    var isSubscribed = true

    // 保证 nextListeners 不和 currentListeners 一致，nextListeners 不会影响到 currentListener
    ensureCanMutateNextListeners()
    // 把要添加的监听器加入 nextListeners
    nextListeners.push(listener)

    // 删除方法
    return function unsubscribe() {
      if (!isSubscribed) {
        return
      }

      // 在 dispatch 过程中不能删除
      if (isDispatching) {
        throw new Error(
          'You may not unsubscribe from a store listener while the reducer is executing. ' +
          'See http://redux.js.org/docs/api/Store.html#subscribe for more details.'
        )
      }

      isSubscribed = false

      ensureCanMutateNextListeners()
      // 把监听器从 nextListeners 中移除
      var index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
    }
  }

  /**
   * dispatch action， 触发 state tree 更新
   *
   * 调用 reducer 方法，每个 reducer 中的返回值就是下一个 state tree 中对应的值，并且会通知所有的 listeners
   *
   * 基本实现只支持派发简单的对象， 如果要支持Promise，Observable，Thunk或其他东西，要自己添加中间件支持
   *
   * @param {Object} action 表示变更内容的简单对象，保持序列化是一个好主意，这样就可以记录和重放用户会话， 参考 devtools
   * action 必须有一个 type 属性，通常使用 String 类型
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   *
   * 如果自定义中间件，可以返回其他内容，比如 Promise
   */
  function dispatch(action) {
    // action 必须是简单对象
    if (!isPlainObject(action)) {
      throw new Error(
        'Actions must be plain objects. ' +
        'Use custom middleware for async actions.'
      )
    }

    // action 必须有 type 属性
    if (typeof action.type === 'undefined') {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
        'Have you misspelled a constant?'
      )
    }


    if (isDispatching) {
      throw new Error('Reducers may not dispatch actions.')
    }

    try {
      // 设置为正在运行
      isDispatching = true
      currentState = currentReducer(currentState, action)
    } finally {
      isDispatching = false
    }

    // 运行完成之后下一个 listeners 赋值到当前 listeners
    var listeners = currentListeners = nextListeners
    for (var i = 0; i < listeners.length; i++) {
      // 执行所有 listener
      listeners[i]()
    }

    // 返回 action
    return action
  }

  /**
   * 替换当前的 reducer
   *
   * 代码拆分动态加载 reducer 和热替换的时候会用到
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    // 必须是函数
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.')
    }

    currentReducer = nextReducer
    // 替换完成后触发init
    dispatch({ type: ActionTypes.INIT })
  }

  /**
   * // 生成一个派发给 observer 对象的方法
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/zenparsing/es-observable
   */
  function observable() {
    var outerSubscribe = subscribe
    return {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        var unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  }
}
