/**
 * jsdom does not implement every browser API. main.js reads two of them at
 * load time, so without these stubs the file throws on require before a
 * single assertion runs.
 *
 * matchMedia is the one that actually bites: main.js calls it at module
 * scope to check prefers-reduced-motion.
 */
window.matchMedia = window.matchMedia || function matchMedia(query) {
    return {
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    };
};

// Guarded in main.js by `'ResizeObserver' in window`, but defining it keeps
// the hero-frame branch exercisable rather than silently skipped.
window.ResizeObserver = window.ResizeObserver || class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

window.requestAnimationFrame = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
window.cancelAnimationFrame = window.cancelAnimationFrame || ((id) => clearTimeout(id));

// Used by the gallery preview. jsdom has no real blob URL machinery.
if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => 'blob:mock-url';
    window.URL.revokeObjectURL = () => {};
}
