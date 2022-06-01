"use strict";

// MyPromise-1
// 1. 默认3个状态, 默认pending, 状态改变后, 状态不可逆
// 2. 如果是异步执行 resolve 的, 收集异步回调函数到收集, 等待 resolve 执行的时候, 就立即执行所有异步回调


const PENDING = "pending";
const RESOLVED = "resolved";
const REJECTED = "rejected";

/**
 * 判断参数是否是函数
 * @param {Function} fn
 * @returns {boolean}
 */
const isFunction = (fn) => fn && typeof fn === "function";

class Commitment {
  constructor(executor) {
    if (!isFunction(executor)) {
      throw new TypeError("executor must be a function");
    }
    this.status = PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.resolvedCallbacks = [];
    this.rejectedCallbacks = [];

    // executor 中的 resolve/reject 必须用箭头函数来防止改变this
    const resolve = (value) => {
      // 状态不可逆: 也就是说必须是 pending 状态才能改变状态
      // 一旦不是 pending 就证明 状态已经改变过了
      if (this.status === PENDING) {
        this.status = RESOLVED;
        this.value = value;
        // 执行异步回调: 什么时候 resolve, 什么时候执行异步回调
        this.resolvedCallbacks.forEach((fn) => fn(value));
      }
    };

    const reject = (reason) => {
      if (this.status === PENDING) {
        this.status = REJECTED;
        this.reason = reason;
        this.rejectedCallbacks.forEach((fn) => fn(reason));
      }
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  then(onResolved, onRejected) {
    // onResolved 和 onReject 都必须是函数
    if (!isFunction(onResolved)) {
      onResolved = (value) => value;
    }

    if (!isFunction(onRejected)) {
      onRejected = (reason) => {
        throw new Error(reason);
      };
    }

    // pending
    // 如果状态是 pending 的时候, 说明 executor 中没有立即改变
    // 状态(也就是说: resolve / reject 没有立即执行)
    // 使用发布订阅的模式: 保存异步回调, 当 resolve/reject 执行
    // 的时候触发所有回调函数执行
    if (this.status === PENDING) {
      // 不能直接 push(onResolved/onRejected)
      // 这样无法将 value / reason 当做参数传入到函数中
      // 单 resolve, reject 直接执行的时候, 结果就丢失了
      this.resolvedCallbacks.push(() => {
        onResolved(this.value);
      });
      this.rejectedCallbacks.push(() => {
        onRejected(this.reason);
      });
    }

    // 如果,状态不等于 pending, 说明执行 executor 的时候,
    // 状态已经被改变了(resolve, reject 是执行过的的), 直接执行回调

    // resolved
    if (this.status === RESOLVED) {
      onResolved(this.value);
    }

    // rejected
    if (this.status === REJECTED) {
      onRejected(this.reason);
    }
  }
}

// 1. 默认是 pending 状态, 改变状态后, 无法再次修改
const c = new MyPromise((resolve, reject) => {
  // const c = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve(11);
    reject(22);
  }, 1000);
});

// 依次执行异步回调
c.then(
  (val) => {
    console.log("then-resolve-1:", val);
  },
  (err) => {
    console.log("then-reject-1:", err);
  }
);

c.then(
  (val) => {
    console.log("then-resolve-2:", val);
  },
  (err) => {
    console.log("then-reject-2:", err);
  }
);
