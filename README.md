# coc-lightbulb

Code action 💡 for coc.nvim

Show a lightbulb if there are available codeActions for current cursor position

![demo](https://user-images.githubusercontent.com/47070852/132829062-519f5f76-bdc2-4ff4-a5f4-fcaf05673396.gif)

## Install

`:CocInstall coc-lightbulb`

## Configuration

| name                            | default | description                                                     |
| ------------------------------- | ------- | --------------------------------------------------------------- |
| `lightbulb.only`                | `[]`    | Array of codeActionKind used for filtering                      |
| `lightbulb.excludeFiletypes`    | `[]`    | Disable lightbulb in these filetyps                             |
| `lightbulb.enableVirtualText`   | `true`  | Whether to show virtual text(neovim only)                       |
| `lightbulb.virtualTextPosition` | `auto`  | Virtual text position                                           |
| `lightbulb.virtualTextPriority` | `50`    | Priority of virtual text                                        |
| `lightbulb.enableSign`          | `false` | Whether to show sign                                            |
| `lightbulb.signPriority`        | `20`    | Priority of sign                                                |
| `lightbulb.followDiagnostic`    | `true`  | Don't show lightbulb when `b:coc_diagnostic_disable equal` to 1 |

```jsonc
{
  "lightbulb.text": {
    // nerd-font: nf-mdi-lightbulb, text used when there're code actions
    "default": "",
    // nerd-font: nf-mdi-auto_fix, text used when there're code actions and quickfix exists
    "quickfix": ""
  }
}
```

## Usage

1. The variable `b:coc_lightbulb_status` will always be set and you can use it for the statusline

2. How to disable lightbulb for current buffer ?

```vim
let b:coc_lightbulb_disable = 1
```

3. highlights

by default

```vim
" virtual text
hi default LightBulbDefaultVirtualText guifg=#FDD164
hi default link LightBulbQuickFixVirtualText LightBulbDefaultVirtualText
" sign
hi default LightBulbDefaultSign guifg=#FDD164
hi default link LightBulbQuickFixSign LightBulbDefaultSign
" for numhl, you can set LightBulbDefaultSignLine, LightBulbQuickFixSignLine
```

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
