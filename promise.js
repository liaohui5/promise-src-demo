"use strict";

/*
1) 完成了所有静态辅助方法及 finally
finally
all
allSettled
race
*/

const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

/**
 * 是否可迭代
 * @param {any} x
 * @returns {boolean}
 */
function isIterable(x) {
  return x && typeof x === "object" && typeof x[Symbol.iterator];
}

/**
 * 是否是一个 thenable 对象/函数(MyPromise实例)
 * @param {any} x
 * @returns {boolean}
 */
function isPromise(x) {
  if ((x && typeof x === "object") || isFunction(x)) {
    return typeof x.then === "function";
  }
  return false;
}

function resolvePromise(promise2, x, resolve, reject) {
  if (promise2 === x) {
    return reject(new TypeError("Chaining cycle detected for promise #<MyPromise>"));
  }

  let isCalled = false;
  if ((x && typeof x === "object") || typeof x === "function") {
    try {
      const then = x.then;
      if (typeof then === "function") {
        then.call(
          x,
          (y) => {
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
        resolve(x);
      }
    } catch (e) {
      if (isCalled) return;
      isCalled = true;
      reject(e);
    }
  } else {
    resolve(x);
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

  catch(errorCallback) {
    return this.then(null, errorCallback);
  }

  finally(finallyCallback) {
    /**************************************
    1.finally 无论外面的Promise成功还是失败都要走井且回调不带参数
    2.正常走finally之后then 或者 catch
    3.如果 finally 内部有promise 并且有延时处理，整个finally会等待
    4.如果两个都是成功取外面的结果
    5.如果外面是成功里面是失败取里面的结果（失败）
    6.如果外面是失败里面是成功取外商的结果（失败）
    7.如果外面是失败里面是失败取里面的结果（失败）
    8.如果外面是成功里面是成功取外面的结果（成功）
    ***********************************/
    return this.then(
      (value) => {
        return MyPromise.resolve(finallyCallback()).then(() => value);
      },
      (reason) => {
        return MyPromise.resolve(finallyCallback()).then(() => {
          throw reason;
        });
      }
    );
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

  static resolve(value) {
    // Promise.resolve 其实就是一个语法糖
    return new MyPromise((resolve) => resolve(value));
  }

  static reject(reason) {
    // Promise.reject 其实就是一个语法糖
    return new MyPromise((_resolve, reject) => reject(reason));
  }

  static all(items) {
    // 必须传入一个可迭代对象
    if (!isIterable(items)) {
      throw new TypeError("The paramter is not iterable: " + items);
    }

    // 获取结果, 不管是Promise还是普通值
    function getValue(x, reject, callback) {
      // 判断是否是 Promise 对象, 如果是Promise对象, 就先用 then 获取到值
      if ((x && typeof x === "object") || typeof x === "function") {
        try {
          if (typeof x.then === "function") {
            x.then(callback, reject);
          } else {
            callback(x);
          }
        } catch (e) {
          reject(e);
        }
        return;
      }
      // 普通值
      return callback(x);
    }

    return new MyPromise((resolve, reject) => {
      // 如果是可以迭代的, 一定可以转数组,
      // 否则map/set是size而不是length
      items = Array.from(items);
      const len = items.length;
      if (len === 0) {
        return resolve([]);
      }
      const results = new Array(len);
      for (let i = 0; i < len; i++) {
        getValue(items[i], reject, (val) => {
          results[i] = val;
          // 如果最后一个结果, 就将所有结果 resolve 出去
          i === len - 1 && resolve(results);
        });
      }
    });
  }

  static allSettled(items) {
    if (!isIterable(items)) {
      throw new TypeError("The paramter is not iterable: " + items);
    }

    function getValue(x, reject, callback) {
      // 判断是否是 Promise 对象, 如果是Promise对象, 就先用 then 获取到值
      if ((x && typeof x === "object") || typeof x === "function") {
        try {
          if (typeof x.then === "function") {
            // 不管成功/失败, 都需要获得结果
            x.then(
              (value) => callback({ status: FULFILLED, value }),
              (reason) => callback({ status: REJECTED, reason })
            );
          } else {
            // 普通值
            callback({ status: FULFILLED, value: x });
          }
        } catch (e) {
          reject(e);
        }
        return;
      }

      // 普通值
      return callback({ status: FULFILLED, value: x });
    }

    return new MyPromise((resolve, reject) => {
      items = Array.from(items);
      const len = items.length;
      if (len === 0) {
        return resolve([]);
      }

      // new 一个指定长度的数组
      const results = new Array(len);
      for (let i = 0; i < len; i++) {
        getValue(items[i], reject, (val) => {
          results[i] = val;
          i === len - 1 && resolve(results);
        });
      }
    });
  }

  static race(items) {
    if (!isIterable(items)) {
      throw new TypeError("The paramter is not iterable, ", items);
    }
    return new MyPromise((resolve, reject) => {
      for (let item of items) {
        // 竞争状态, 谁先改变状态/普通值,谁先直接resolve/reject
        if (isPromise(item)) {
          item.then(resolve, reject);
        } else {
          resolve(item);
        }
      }
    });
  }
}

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

// -------------------------------

function getAsyncRand(id) {
  return new MyPromise((resolve) => {
    setTimeout(() => {
      resolve(id + ":" + Math.random().toString(16).substring(2));
    }, 1000);
  });
}
const getRejected = (x) => MyPromise.reject(x + ":" + Math.random());

MyPromise.allSettled([getAsyncRand(1), getRejected(2), getAsyncRand(3), getRejected(4), getAsyncRand(5)])
  .then((values) => {
    console.log(values);
  })
  .catch((e) => {
    console.log(e);
  });
