import {
  CancellationTokenSource,
  CodeActionContext,
  diagnosticManager,
  Document,
  languages,
  window,
  workspace,
  Neovim,
  ExtmarkOptions,
} from 'coc.nvim';

import { config as cfg } from './config';
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

    buffer.setVar('coc_lightbulb_status', cfg.statusText);

    if (cfg.enableVirtualText) this.showVirtualText(doc);

    if (cfg.enableSign)
      // @ts-ignore
      buffer.placeSign({
        lnum: (await workspace.getCurrentState()).position.line + 1,
        name: 'LightBulbSign',
        group: 'CocLightbulb',
      });
  }

  /*
    try to find the best position
    */
  private async showVirtualText(doc: Document) {
    const chunks: [string, string][] = [[cfg.virtualText, 'LightBulbVirtualText']];
    const state = await workspace.getCurrentState();
    let lnum = state.position.line;

    if (!cfg.nvim6) {
      // no more updated this api
      this.nvim.call('nvim_buf_set_virtual_text', [doc.bufnr, this.NS, lnum, chunks, {}], true);
      return;
    }

    const buffer = doc.buffer;

    if (cfg.virtualTextPosition !== 'auto') {
      buffer.setExtMark(this.NS, lnum, 0, {
        hl_mode: 'combine',
        virt_text: chunks,
        virt_text_pos: cfg.virtualTextPosition,
        priority: cfg.virtualTextPriority,
      });
      return;
    }

    //////////////////////////////////////////////////////////////////////////
    //  left > right(very close and no other virtual text) > top > bottom
    //////////////////////////////////////////////////////////////////////////

    const padding = cfg.virtualTextPadding;

    // place eol by default, because it's safe
    let col = 0;
    let opts: ExtmarkOptions = { virt_text_pos: 'eol' };

    const line = state.document.lineAt(lnum);
    const curCol = state.position.character;
    let offset = line.firstNonWhitespaceCharacterIndex;

    // make sure offset <= curCol <= length
    if (curCol < offset) {
      offset = curCol;
    }
    const end = line.range.end.character;

    const right_top_bottom = (() => {
      let ret: boolean | undefined;
      return async () => {
        // cached
        if (ret !== undefined) return ret;
        // right
        if (
          end - curCol < 30 &&
          (await this.nvim.call('winwidth', [0])) - end > padding &&
          // If there is already virtual text on the right, choose the left first.
          // This avoid distracting the developer with too much virtual text moving around
          !(await this.checkVirtualTextEol(doc.bufnr, lnum, this.NS))
        ) {
          col = 0;
          opts = { virt_text_pos: 'eol' };
          ret = true;
          return ret;
        }
        // top
        if (lnum) {
          const previousLineEnd = doc.textDocument.lineAt(lnum - 1).range.end.character;
          if (previousLineEnd + padding < curCol || previousLineEnd == 0) {
            lnum = lnum - 1;
            opts = {
              virt_text_win_col: previousLineEnd + padding,
            };
            ret = true;
            return ret;
          }
        }
        // bottom
        if (lnum < doc.lineCount - 1) {
          const lastLineEnd = doc.textDocument.lineAt(lnum + 1).range.end.character;
          if (lastLineEnd + padding < curCol || lastLineEnd == 0) {
            lnum = lnum + 1;
            opts = {
              virt_text_win_col: lastLineEnd + padding,
            };
            ret = true;
            return ret;
          }
        }
        ret = false;
        return ret;
      };
    })();

    if (offset < padding) {
      // The left is not possible, there are only 3 cases
      await right_top_bottom();
    } else {
      // can be left

      // The left side may not be the best
      if (curCol - offset + padding <= Math.min(30, end - curCol)) {
        // left is the best
        opts = { virt_text_pos: 'overlay' };
        col = offset - padding;
      } else {
        if (!(await right_top_bottom())) {
          // left is not the expected, but no one is better
          opts = { virt_text_pos: 'overlay' };
          col = offset - padding;
        }
      }
    }

    buffer.setExtMark(this.NS, lnum, col, {
      hl_mode: 'combine',
      virt_text: chunks,
      priority: cfg.virtualTextPriority,
      ...opts,
    });
  }

  private async clear(doc: Document, force?: boolean) {
    const { buffer } = doc;
    buffer.setVar('coc_lightbulb_status', '');
    if (force || cfg.enableVirtualText) buffer.clearNamespace(this.NS);
    // @ts-ignore
    if (force || cfg.enableSign) buffer.unplaceSign({ group: 'CocLightbulb' });
  }

  public async refresh(forceClear?: boolean) {
    const doc = await workspace.document;
    if (!doc || !doc.attached) return;
    if (cfg.excludeFiletypes.includes(doc.filetype)) return;
    const buffer = doc.buffer;

    const disabled =
      (await buffer.getVar('coc_lightbulb_disable')) == 1 ||
      (cfg.followDiagnostic && (await buffer.getVar('coc_diagnostic_disable')) == 1);

    const show = !disabled && (await this.hasCodeActions(doc, cfg.only));
    await this.clear(doc, forceClear);
    if (show) await this.show(doc);
  }

  private async checkVirtualTextEol(bufnr: number, lnum: number, excludeNamespace?: number) {
    return await this.nvim.call('luaeval', [
      `__coc_lightbulb_check_virt_text_eol(${bufnr}, ${lnum}, ${
        excludeNamespace == undefined ? 'nil' : excludeNamespace
      })`,
    ]);
  }
}

export const lightbulb = new Lightbulb();
