// The desktop build reads labels with the native reader (electron/main.js), so the large
// in-browser OCR engine is left out of it. `npm run dev` still uses the real one.
export const PaddleOCR = {
  create() {
    throw new Error('The in-browser label reader is not part of this build. Paste the label text instead.')
  },
}
