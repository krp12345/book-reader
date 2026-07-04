// Public API surface — the names consumers import. Kept as the sole root-barrel
// export so `../types` resolves exactly the public types (unchanged surface).
// Internal layer types live in the sibling folders (`./core`, `./hooks`,
// `./components`) and are imported by their implementation modules directly.
export * from './public';
