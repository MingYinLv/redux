import { ActionTypes } from './createStore'
import isPlainObject from 'lodash/isPlainObject'
import warning from './utils/warning'

function getUndefinedStateErrorMessage(key, action) {
  var actionType = action && action.type
  var actionName = actionType && `"${actionType.toString()}"` || 'an action'

  return (
    `Given action ${actionName}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state.`
  )
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) {
  var reducerKeys = Object.keys(reducers)
  var argumentName = action && action.type === ActionTypes.INIT ?
    'preloadedState argument passed to createStore' :
    'previous state received by the reducer'

  if (reducerKeys.length === 0) {
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    )
  }

  if (!isPlainObject(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      ({}).toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }

  var unexpectedKeys = Object.keys(inputState).filter(key =>
    !reducers.hasOwnProperty(key) &&
    !unexpectedKeyCache[key]
  )

  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })

  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}

function assertReducerSanity(reducers) {
  Object.keys(reducers).forEach(key => {
    var reducer = reducers[key]
    // 对所有的 reducer 进行初始化
    var initialState = reducer(undefined, { type: ActionTypes.INIT })

    // 如果某个初始化的 state 为 undefined， 报错
    if (typeof initialState === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
        `If the state passed to the reducer is undefined, you must ` +
        `explicitly return the initial state. The initial state may ` +
        `not be undefined.`
      )
    }

    var type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.')
    // 其他所有未知的 action type 必须返回当前的 state tree
    if (typeof reducer(undefined, { type }) === 'undefined') {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
        `Don't try to handle ${ActionTypes.INIT} or other actions in "redux/*" ` +
        `namespace. They are considered private. Instead, you must return the ` +
        `current state for any unknown actions, unless it is undefined, ` +
        `in which case you must return the initial state, regardless of the ` +
        `action type. The initial state may not be undefined.`
      )
    }
  })
}

/**
 * 将多个 reducer function 转换成一个 reducer function，它会调用所有的 reducer function，并将
 * 所有的 reducer 的返回结果应用到对应的 state tree 中
 *
 * @param {Object} reducers 的对象集合，对于任何操作 reducer 都不会返回 undefined
 * 如果传给 reducer 的 state 为定义，会返回初始状态
 *
 * @returns {Function} 一个 reducer function，它调用 reducers 中所有的 reducer function
 * 并应用到对应的 state tree 中
 */
export default function combineReducers(reducers) {
  var reducerKeys = Object.keys(reducers)
  var finalReducers = {}
  for (var i = 0; i < reducerKeys.length; i++) {
    var key = reducerKeys[i]

    if (process.env.NODE_ENV !== 'production') {
      // 开发环境下如果某个 reducer 为 undefined ，发出警告
      if (typeof reducers[key] === 'undefined') {
        warning(`No reducer provided for key "${key}"`)
      }
    }

    // 如果 reducer 是 function，赋值
    if (typeof reducers[key] === 'function') {
      finalReducers[key] = reducers[key]
    }
  }

  //所有的 reducer name
  var finalReducerKeys = Object.keys(finalReducers)

  if (process.env.NODE_ENV !== 'production') {
    var unexpectedKeyCache = {}
  }

  var sanityError
  try {
    // 验证所有的reducer
    assertReducerSanity(finalReducers)
  } catch (e) {
    // 捕获错误
    sanityError = e
  }

  return function combination(state = {}, action) {
    // 如果有错误抛出
    if (sanityError) {
      throw sanityError
    }

    if (process.env.NODE_ENV !== 'production') {
      var warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache)
      if (warningMessage) {
        warning(warningMessage)
      }
    }

    // state tree 是否更新
    var hasChanged = false
    var nextState = {}
    for (var i = 0; i < finalReducerKeys.length; i++) {
      var key = finalReducerKeys[i] // reducer name
      var reducer = finalReducers[key] // reducer function
      var previousStateForKey = state[key] // 之前的 state 值
      var nextStateForKey = reducer(previousStateForKey, action) // 调用 reducer 之后的 state 值
      // 如果返回值是 undefined
      if (typeof nextStateForKey === 'undefined') {
        var errorMessage = getUndefinedStateErrorMessage(key, action)
        throw new Error(errorMessage)
      }
      // 赋值
      nextState[key] = nextStateForKey
      // 浅对比
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    }
    // 如果没有 state 发生变化返回之前的 state
    // PS: 如果 state 是引用类型, 它的子属性发生改变， 不会更新 hasChanged
    return hasChanged ? nextState : state
  }
}
