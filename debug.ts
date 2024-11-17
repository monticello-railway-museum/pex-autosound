let debug_enable = false;

export function setDebugEnable(en: boolean) {
    debug_enable = en;
}

export function debugLog(...args: any[]) {
    if (debug_enable) {
        console.log(...args);
    }
}
