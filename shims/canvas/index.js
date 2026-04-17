// Stub replacement for the "canvas" npm package (a native C++ Node.js addon).
//
// pdfjs-dist optionally requires canvas for server-side PDF rendering in Node.js.
// We only use pdfjs-dist client-side (PdfOrder component), where the browser's
// native <canvas> element is used instead.
//
// The real canvas package can't be bundled by esbuild (it contains .node binaries)
// and can't run on Cloudflare Workers. This stub is referenced via pnpm.overrides
// in package.json to satisfy the require("canvas") call in pdfjs-dist without
// pulling in the native addon.
module.exports = {};
