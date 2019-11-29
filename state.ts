export let states: Array<{ [x: string]: any }> = []

export function addState(state: object) {
    states.push(state)
}

export function removeState(state: object) {
    states = states.filter(s => s !== state)
}

export function withState<T>(state: object, fn: () => T) {
    try {
        addState(state)
        return fn()
    } finally {
        removeState(state)
    }
}

export async function withStateAsync<T>(state: object, fn: () => Promise<T>) {
    try {
        addState(state)
        return await fn()
    } finally {
        removeState(state)
    }
}
