"use strict";

/*
MyPromise-2:
1. then 必须返回一个新的 promise2, 并且这个 promise2 不能是 new Promise 返回的那一个
const p1 = new Promise(()=> {});
const p2 = p1.then();
p1 不能等于 p2, 为了好注释, 方便理解,
将 new Promise 的实例叫 p1
将 then 方法返回的实例叫 p2

2. then 必须异步的执行, 不能阻塞线程, 影响后续代码的执行
*/

const PENDING = "pending";
const RESOLVED = "resolved";
const REJECTED = "rejected";

/**
 * 判断参数是否是函数
 * @param {Function} fn
 * @returns {boolean}
 */
const isFunction = (fn) => fn && typeof fn === "function";

/**
 * 用 p2 的(resolve/reject)回调来处理 p1 的结果
 * @param {MyPromise} promise2
 * @param {any} x p1 的处理(resolve/rejecd)结果
 * @param {Function} resolve p2 的 resolve 回调
 * @param {Function} reject p2 的 reject 回调
 */
function resolvePromise(promise2, x, resolve, reject) {
  console.log(promise2, x, resolve, reject);
}

class MyPromise {
  constructor(executor) {
    if (!isFunction(executor)) {
      throw new TypeError("executor must be a function");
    }
    this.status = PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.resolvedCallbacks = [];
    this.rejectedCallbacks = [];

    const resolve = (value) => {
      if (this.status === PENDING) {
        this.status = RESOLVED;
        this.value = value;
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

  // then 方法必须返回一个新的 promise
  then(onResolved, onRejected) {
    if (!isFunction(onResolved)) {
      onResolved = (value) => value;
    }

    if (!isFunction(onRejected)) {
      onRejected = (reason) => {
        throw new Error(reason);
      };
    }

    const promise2 = new MyPromise((resolve, reject) => {
      // pending
      // p1 的 then的回调(onResolved/onRejected)必须返回一个值 x
      let x;

      // resolved
      if (this.status === RESOLVED) {
        // 为什么要 setTimout?
        // 因为 then 函数必须异步执行, 不能阻塞线程
        // 而且, 只有异步的执行, 才能 p2 的 executor 中获取到 "promise2" 这个变量
        // 如果同步执行, 无法获取到这个变量, 会抛出异常
        setTimeout(() => {
          // 为什么要 try?
          // 如果 p1.then 的回调(onResolved/onRejected)抛出了异常,
          // 那么就用 p2 的 reject 去改变 p2 的状态, 并且将异常作为 p2 的 reason
          // 就像 constructor 中也会捕获 p1 的 executor 中的异常, 然后直接 reject
          try {
            x = onResolved(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      }

      // rejected
      if (this.status === REJECTED) {
        setTimeout(() => {
          try {
            x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      }

      if (this.status === PENDING) {
        this.resolvedCallbacks.push(() => {
          setTimeout(() => {
            try {
              x = onResolved(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });
        this.rejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              x = onRejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });
      }
    });

    return promise2;
  }
}

const p1 = new MyPromise((resolve, reject) => {
  setTimeout(() => {
    resolve(11);
  }, 1000);
});

const p2 = p1.then(() => {
  throw new Error("p1-then-error");
});

p2.then(undefined, (reason) => {
  console.log(reason);
});
