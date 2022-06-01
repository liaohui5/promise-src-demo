"use strict";

/*
MyPromise-3:
1. 实现 catch 方法
2. 解决 then 链式调用的问题
3. 按照 Promise/A+ 规范实现 resolvePromise
4. docs: https://promisesaplus.com/
-----

核心源码已经实现完成了,还差一些其他方法
finaly
Promise.resolve
Promise.reject
Promise.all
Promise.race
*/

const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

/**
 * 用 p2 的(resolve/reject)回调来处理 p1 的结果
 * 必须按照这个 promise/A+ 规范来写这个函数
 * @docs https://promisesaplus.com/
 * @docs 中文版: https://juejin.cn/post/7001775082339041288
 * @param {MyPromise} promise2
 * @param {any} x p1 的处理(resolve/rejecd)结果
 * @param {Function} resolve p2 的 resolve 回调
 * @param {Function} reject p2 的 reject 回调
 */
function resolvePromise(promise2, x, resolve, reject) {
  if (promise2 === x) {
    return reject(new TypeError("Chaining cycle detected for promise #<MyPromise>"));
  }

  let isCalled = false;
  if ((x && typeof x === "object") || typeof x === "function") {
    // 如果x是一个对象/function, 那么就有可能是 then 方法里嵌套了 MyPromise
    try {
      // 为什么这里要 try?
      // 防止 x.then 被劫持 Object.define(x, 'then', { get() { throw new Error('xx') } })
      const then = x.then;
      if (typeof then === "function") {
        then.call(
          x,
          // 递归调用是防止在 executor 的 resolve 的值是一个 MyPromise 实例
          // 如果 p1 resolve 的结果是一个 MyPromise 实例, 那么就需要递归的调用
          (y) => {
            // 防止先调用 resolve 然后又调用 reject
            if (isCalled) return;
            isCalled = true;
            resolvePromise(promise2, y, resolve, reject);
          },
          (r) => {
            if (isCalled) return;
            isCalled = true;
            reject(r);
          }
        );
      } else {
        // 如果 x.then 不是一个方法, 说明不是 MyPromise 实例, 而是一个普通值
        resolve(x);
      }
    } catch (e) {
      if (isCalled) return;
      isCalled = true;
      reject(e);
    }
  } else {
    // 如果 x 不是一个对象/function,证明不可能是嵌套的 MyPromise,
    // 所以 x 一定是一个非 MyPromise 的普通的值, 直接 resolve 就可以了
    if (isCalled) return;
    resolve(x);
    isCalled = true;
  }
}

class MyPromise {
  constructor(executor) {
    if (typeof executor !== "function") {
      throw new TypeError("executor must be a function");
    }
    this.status = PENDING;
    this.value = undefined;
    this.reason = undefined;
    this.resolvedCallbacks = [];
    this.rejectedCallbacks = [];

    const resolve = (value) => {
      if (this.status === PENDING) {
        if (value instanceof MyPromise) {
          value.then(resolve, reject);
          return;
        }
        this.status = FULFILLED;
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

  then(onFulfilled, onRejected) {
    if (typeof onFulfilled !== "function") {
      onFulfilled = (value) => value;
    }

    if (typeof onRejected !== "function") {
      onRejected = (reason) => {
        throw reason;
      };
    }

    // then 方法必须返回一个新的 promise
    const promise2 = new MyPromise((resolve, reject) => {
      // resolved
      if (this.status === FULFILLED) {
        setTimeout(() => {
          try {
            let x = onFulfilled(this.value);
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
            let x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        });
      }

      // pending
      if (this.status === PENDING) {
        this.resolvedCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onFulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          });
        });

        this.rejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onRejected(this.reason);
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

// p1.then -> p2(new Promise(res, rej)) -> 异步执行:判断p1状态 -> 处理p1的结果
// p2.then -> p3(new Promise(res, rej)) -> 异步执行:判断p2状态 -> 处理p2的结果

// ---- 测试是否符合规范脚本 ---
if (typeof window === "undefined") {
  MyPromise.defer = MyPromise.deferred = function () {
    const deferred = {};
    deferred.promise = new MyPromise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  };

  module.exports = MyPromise;
}
