# coc-lightbulb

VSCode 💡 for coc.nvim

## Install

`:CocInstall coc-lightbulb`

## Configuration

| name                          | default | description                                                                 |
| ----------------------------- | ------- | --------------------------------------------------------------------------- |
| `lightbulb.only`              | `[]`    | Array of codeActionKind used for filtering                                  |
| `lightbulb.enableVirtualText` | `true`  | Whether to show virtual text                                                |
| `lightbulb.virtualText`       | `💡`    | Text to show at virtual text. The highlight group is `LightBulbVirtualText` |
| `lightbulb.statusText`        | `💡`    | Text to set of local buffer variable `b:coc_lightbulb_status`               |

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
