import { defineComponent, h, onMounted, shallowRef, type Component } from 'vue'

/** Render an action-loaded feature with a retryable download failure. */
export function lazyFeature(load: () => Promise<{ default: Component }>) {
  let resolved: Component | undefined
  let request: Promise<Component> | undefined
  return defineComponent({
    inheritAttrs: false,
    setup(_, { attrs }) {
      const component = shallowRef(resolved)
      const error = shallowRef('')
      async function open() {
        error.value = ''
        try {
          component.value = await (request ??= load().then(module => (resolved = module.default)).catch(reason => {
            request = undefined
            throw reason
          }))
        } catch (reason) { error.value = reason instanceof Error ? reason.message : String(reason) }
      }
      onMounted(open)
      return () => component.value ? h(component.value, attrs) : h('div', { role: 'status' }, error.value
        ? [h('span', error.value), h('button', { type: 'button', onClick: open }, 'Retry loading')]
        : 'Loading…')
    },
  })
}
