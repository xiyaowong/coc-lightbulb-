# coc-lightbulb

VSCode 💡 for coc.nvim

Show a lightbulb if there are available codeActions for current cursor position

![demo](https://user-images.githubusercontent.com/47070852/132829062-519f5f76-bdc2-4ff4-a5f4-fcaf05673396.gif)

## Install

`:CocInstall coc-lightbulb`

## Configuration

| name                          | default | description                                                                 |
| ----------------------------- | ------- | --------------------------------------------------------------------------- |
| `lightbulb.only`              | `[]`    | Array of codeActionKind used for filtering                                  |
| `lightbulb.excludeFiletypes`  | `[]`    | Disable lightbulb in these filetyps                                         |
| `lightbulb.enableVirtualText` | `true`  | Whether to show virtual text                                                |
| `lightbulb.virtualText`       | `💡`    | Text to show at virtual text. The highlight group is `LightBulbVirtualText` |
| `lightbulb.enableSign`        | `false` | Whether to show sign                                                        |
| `lightbulb.signText`          | `💡`    | Text of lightbulb sign. highlights: `LightBulbSign`, `LightBulbSignLine`    |
| `lightbulb.statusText`        | `💡`    | Text to set of local buffer variable `b:coc_lightbulb_status`               |

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
