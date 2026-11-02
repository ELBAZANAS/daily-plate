# Third-party notices

Daily Plate's own code is licensed under the PolyForm Noncommercial License 1.0.0 (see `LICENSE`).
The parts below come from others and keep their own licenses.

## Exercise data

`src/data/exercise-catalog.json` (exercise names, body parts, equipment, target muscles and the
English and Chinese instructions) is adapted from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), released under
the MIT License:

```
MIT License

Copyright (c) 2026 Hasan Emir Yıldırım

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation and data files (the "Software"),
to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

------------------------------------------------------------------------------
MEDIA EXCEPTION
------------------------------------------------------------------------------

The MIT license above covers ONLY the code, tooling, dataset structure, and
instruction text/translations in this repository.

It DOES NOT cover the exercise media in the `images/` and `videos/`
directories. That media is © Gym visual (https://gymvisual.com/) and is
included here with the rights holder's written permission, at 180×180
resolution, and must retain the attribution "© Gym visual —
https://gymvisual.com/". Its use and reuse are governed by Gym visual's Terms
& Conditions (https://gymvisual.com/content/3-terms-and-conditions-of-use) and
by `NOTICE.md` in this repository — NOT by the MIT license above. Cloning this
repository does not grant you any license to the media; obtain your own from
Gym visual.
```

## Exercise photos and animations

The exercise photos and animations are © Gym visual — https://gymvisual.com/. They are **not**
included in this repository and are not covered by its license. `npm run media` downloads them from
the dataset above, which redistributes them at 180×180 with Gym visual's permission. Their use is
governed by [Gym visual's terms](https://gymvisual.com/content/3-terms-and-conditions-of-use).

## Archivo typeface

`src/fonts/archivo-*.woff2` — Copyright 2020 The Archivo Project Authors
(https://github.com/Omnibus-Type/Archivo), licensed under the SIL Open Font License 1.1. The full
license is in `src/fonts/OFL-LICENSE.txt`.

## npm packages

Packages installed by `npm install` (React, Vite, Electron, PaddleOCR and others) are covered by
their own licenses, listed in each package's folder under `node_modules`.
