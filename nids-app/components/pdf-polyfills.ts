if (typeof window === "undefined") {
  if (typeof global !== "undefined") {
    if (!global.DOMMatrix) {
      ;(global as any).DOMMatrix = class DOMMatrix {}
    }
    if (!global.Path2D) {
      ;(global as any).Path2D = class Path2D {}
    }
    if (!global.Promise.withResolvers) {
      ;(global as any).Promise.withResolvers = function () {
        let resolve, reject
        const promise = new Promise((res, rej) => {
          resolve = res
          reject = rej
        })
        return { promise, resolve, reject }
      }
    }
  }
}
export {}
