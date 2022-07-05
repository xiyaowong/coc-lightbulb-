import {
  CancellationTokenSource,
  CodeActionContext,
  diagnosticManager,
  Document,
  languages,
  window,
  workspace,
  Neovim,
} from 'coc.nvim';

import { config } from './config';
import { CodeAction, CodeActionKind } from 'vscode-languageserver-protocol';

class Lightbulb {
  private NS!: number;
  private nvim: Neovim;
  private tokenSource: CancellationTokenSource | undefined;

  constructor() {
    this.nvim = workspace.nvim;
    this.nvim.createNamespace('coc-lightbulb').then((ns) => (this.NS = ns));
  }

  private async hasCodeActions(doc: Document, only?: CodeActionKind[]): Promise<boolean> {
    this.tokenSource?.cancel();
    this.tokenSource = new CancellationTokenSource();
    const token = this.tokenSource.token;

    const range = await window.getSelectedRange('cursor');

    if (!range) return false;

    const diagnostics = diagnosticManager.getDiagnosticsInRange(doc.textDocument, range);
    // @ts-ignore
    const context: CodeActionContext = { diagnostics };

    if (only && only.length > 0) {
      context.only = only;
    }

    // @ts-ignore
    let codeActions: CodeAction[] = await languages.getCodeActions(doc.textDocument, range, context, token);

    if (!codeActions || codeActions.length == 0) return false;
    codeActions = codeActions.filter((o) => !o.disabled);

    return codeActions.length > 0;
  }

  private async show(doc: Document) {
    const { buffer } = doc;
    buffer.setVar('coc_lightbulb_status', config.statusText);

    const state = await workspace.getCurrentState();
    const lnum = state.position.line;

    if (config.enableVirtualText) {
      const chunks: [string, string][] = [[config.virtualText, 'LightBulbVirtualText']];

      if (!config.nvim6) {
        // no more updated this api
        this.nvim.call('nvim_buf_set_virtual_text', [doc.bufnr, this.NS, lnum, chunks, {}], true);
      } else {
        let col: number;
        let pos: 'overlay' | 'eol' | 'right_align';
        if (config.virtualTextPosition == 'auto') {
          const line = state.document.lineAt(lnum);
          const curCol = state.position.character;
          let offset = line.firstNonWhitespaceCharacterIndex;
          // make sure offset <= curCol <= length
          if (curCol < offset) {
            offset = curCol;
          }
          const length = line.text.length;
          if (offset < config.virtualTextPadding) {
            // left side has no enough area to place virt_text
            // so choose [right] side
            pos = 'eol';
            col = 0;
          } else {
            // Side closest to current cursor
            if (curCol - offset + config.virtualTextPadding <= length - curCol) {
              // [left]
              pos = 'overlay';
              col = offset - config.virtualTextPadding;
            } else {
              // If there is already virtual text on the right, choose the left first.
              // This avoid distracting the developer with too much virtual text moving around
              if (await this.nvim.call('luaeval', [`__coc_lightbulb_check_virt_text_eol(${doc.bufnr}, ${lnum})`])) {
                pos = 'overlay';
                col = offset - config.virtualTextPadding;
              } else {
                // [right]
                pos = 'eol';
                col = 0;
              }
            }
          }
        } else {
          pos = config.virtualTextPosition;
          col = 0;
        }
        buffer.setExtMark(this.NS, lnum, col, {
          hl_mode: 'combine',
          virt_text: chunks,
          virt_text_pos: pos,
          priority: config.virtualTextPriority,
        });
      }
    }

    if (config.enableSign)
      // @ts-ignore
      buffer.placeSign({
        lnum: lnum + 1,
        name: 'LightBulbSign',
        group: 'CocLightbulb',
      });
  }

  async clear(doc: Document, force?: boolean) {
    const { buffer } = doc;
    buffer.setVar('coc_lightbulb_status', '');
    if (force || config.enableVirtualText) buffer.clearNamespace(this.NS);
    // @ts-ignore
    if (force || config.enableSign) buffer.unplaceSign({ group: 'CocLightbulb' });
  }

  public async refresh(forceClear?: boolean) {
    const doc = await workspace.document;
    if (!doc || !doc.attached) return;
    if (config.excludeFiletypes.includes(doc.filetype)) return;
    const buffer = doc.buffer;

    const disabled =
      (await buffer.getVar('coc_lightbulb_disable')) == 1 ||
      (config.followDiagnostic && (await buffer.getVar('coc_diagnostic_disable')) == 1);

    const show = !disabled && (await this.hasCodeActions(doc, config.only));
    this.clear(doc, forceClear);
    if (show) this.show(doc);
  }
}

export const lightbulb = new Lightbulb();
