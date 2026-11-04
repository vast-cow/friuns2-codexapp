import { ref } from 'vue'

/** One controller per owner; failed downloads retain the user's original action. */
export function deferredActions<T extends object>(load: () => Promise<T>) {
  let controller: Promise<T> | undefined
  let pending: (() => Promise<unknown>) | undefined
  const error = ref('')
  async function invoke<K extends keyof T>(key: K, ...args: T[K] extends (...args: infer A) => unknown ? A : never) {
    const run = async () => {
      try {
        const actions = await (controller ??= load().catch(reason => { controller = undefined; throw reason }))
        const action = actions[key] as (...values: typeof args) => unknown
        const result = await action(...args)
        if (pending === run) { pending = undefined; error.value = '' }
        return result
      } catch (reason) {
        if (pending === run) error.value = reason instanceof Error ? reason.message : String(reason)
      }
    }
    pending = run
    return run()
  }
  return { invoke, error, retry: () => pending?.() }
}
