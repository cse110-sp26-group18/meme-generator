# Internal Meme Template Library

## What it is

The internal meme template library is a built-in collection of meme images that
users can pick from instead of (or in addition to) uploading their own photo.
When a user clicks a template card, the chosen image is loaded into the
existing meme editor and behaves exactly the same as an uploaded image —
clicking adds text, text is draggable/resizable, and the meme can be
downloaded.

This feature does **not** replace the upload flow. It only adds another way to
choose a starting meme image.

## Why `templates.json` is the source of truth

All template metadata lives in
[`assets/templates/templates.json`](../assets/templates/templates.json). The
app fetches that file at runtime and renders one card per object in the array.
Keeping templates in JSON means:

- No code changes are required to add, remove, or relabel a template — only a
  data change.
- The same file can be consumed later by tests, build steps, or a future
  back end without parsing markup.
- The library and the assets travel together in version control, so anything
  in the JSON is guaranteed to be in the deployed bundle.

## Data model: 1 image = 1 template object

Every image in the library corresponds to exactly one object in
`templates.json`. Each object has the following fields:

| Field       | Type            | Purpose                                                       |
|-------------|-----------------|---------------------------------------------------------------|
| `id`        | string          | Stable, unique identifier (kebab-case).                       |
| `name`      | string          | Human-readable label shown on the card.                       |
| `character` | string          | Who/what is in the image (e.g. `LeBron`, `SpongeBob`).        |
| `emotion`   | string          | Primary emotion (e.g. `happy`, `sad`, `shocked`).             |
| `category`  | string          | One of: `sports`, `animation`, `animals`, `pop-culture`.      |
| `tags`      | string[]        | Free-form keywords used by search.                            |
| `image`     | string          | Path to the image file, relative to the repo root.            |
| `textBoxes` | array           | Reserved for default text-box placement; leave `[]` for now.  |

`textBoxes` is included in the schema so future work can ship default caption
positions per template, but the current feature ignores it.

## Search and filter

Users mainly find templates by **emotion** and **category**, with name,
character, and tags as additional search surfaces.

- The search input filters by `name`, `character`, `emotion`, and any value in
  `tags` (case-insensitive substring match).
- The category dropdown filters by `category`. Options:
  - All Categories
  - Sports memes
  - Animation memes
  - Animal memes
  - Pop Culture memes

## Categories

Current categories are:

- `sports`
- `animation`
- `animals`
- `pop-culture`

Use the exact strings above when adding new templates. If a new category is
needed, also update the dropdown options in
[`meme-app/js/TemplateLibrary.js`](../meme-app/js/TemplateLibrary.js).

## Image paths

Paths in `templates.json` are written relative to the repo root, e.g.
`assets/templates/lebron-meme-templates/lebron-happy.jpg`. The path must
exactly match the real folder and file name on disk, including the file
extension and capitalization — the app loads images by URL and a typo will
404.

`index.html` lives in `meme-app/`, so the loader prepends `../` to each path
at runtime. Authors of `templates.json` should not include the `../`
themselves.

Filenames may contain spaces or other URL-unsafe characters — the loader
runs each resolved path through `encodeURI` before assigning it to an
`<img>` source. Write the literal on-disk filename in the JSON; do not
hand-encode it.

## Adding a new template

1. Drop the image file into the appropriate subfolder under
   `assets/templates/<character>-meme-templates/`.
2. Add a new object to `assets/templates/templates.json` with all required
   fields (`id`, `name`, `character`, `emotion`, `category`, `tags`,
   `image`, `textBoxes`).
3. Use an existing category, or — if introducing a new one — update the
   category list in `TemplateLibrary.js` and the documentation above.
4. Confirm the image path resolves by reloading the app from a local dev
   server.

## Relationship to the upload flow

The library reuses the existing image-loading pipeline
(`MemeGen.ImageLoader`). Once a template image is loaded into the canvas,
the editor cannot tell whether the image came from a file upload, a drag-
and-drop, or the library — text overlays, dragging, resizing, and download
all work identically.

## Future improvements

- Default text-box placement per template using the `textBoxes` field.
- More categories beyond the current four.
- Richer emotion labels (e.g. multiple emotions per template, or an emotion
  taxonomy).
- A "favorites" or "recent" section.
- Lazy/paginated loading once the library grows past a couple hundred items.
