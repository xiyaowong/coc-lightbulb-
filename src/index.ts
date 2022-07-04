import {
  CancellationTokenSource,
  CodeActionContext,
  diagnosticManager,
  Document,
  events,
  ExtensionContext,
  languages,
  window,
  workspace,
} from 'coc.nvim';
import { CodeAction, CodeActionKind } from 'vscode-languageserver-protocol';

export class Lightbulb {
  private tokenSource: CancellationTokenSource | undefined;

  async show(doc: Document, only?: CodeActionKind[]): Promise<boolean> {
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
}

export async function activate(extCtx: ExtensionContext): Promise<void> {
  const config = workspace.getConfiguration('lightbulb');
  const only = config.get<string[]>('only', [])!;
  const excludeFiletypes = config.get<string[]>('excludeFiletypes', [])!;
  const enableVirtualText =
    workspace.isNvim &&
    workspace.nvim.hasFunction('nvim_buf_set_virtual_text') &&
    config.get<boolean>('enableVirtualText')!;
  const virtualText = config.get<string>('virtualText')!;
  const virtualTextPriority = config.get<number>('virtualTextPriority')!;
  const virtualTextPosition = config.get<'auto' | 'eol' | 'right_align'>('virtualTextPosition')!;
  const virtualTextPadding = 2 * virtualText.length + 2;
  const enableSign = config.get<boolean>('enableSign');
  const signText = config.get<string>('signText')!;
  const statusText = config.get<string>('statusText')!;
  const followDiagnostic = config.get<boolean>('followDiagnostic')!;

  const { nvim } = workspace;
  if (enableVirtualText) nvim.command('hi default LightBulbVirtualText guifg=#FDD164', true);
  if (enableSign) {
    nvim.command('hi default LightBulbSign guifg=#FDD164', true);
    nvim.command(
      `sign define LightBulbSign text=${signText.replace(' ', '')} texthl=LightBulbSign linehl=LightBulbSignLine`,
      true
    );
  }

  const nvim6 = workspace.has('nvim-0.6.0');
  if (nvim6) {
    nvim.lua(`
function _G.__coc_lightbulb_check_virt_text_eol(bufnr, lnum)
	for _, ns_id in pairs(vim.api.nvim_get_namespaces()) do
		local marks = vim.api.nvim_buf_get_extmarks(bufnr, ns_id, { lnum, 0 }, { lnum, -1 }, { details = true })
		if #marks > 0 then
			for _, mark in ipairs(marks) do
				local details = mark[4]
				if details.virt_text and details.virt_text_pos == "eol" then
					return true
				end
			end
		end
	end
  return false
end
         `);
  }

  const ns = await nvim.createNamespace('coc-lightbulb');
  const lightbulb = new Lightbulb();

  const refresh = async () => {
    const doc = await workspace.document;
    if (!doc || !doc.attached) return;
    if (excludeFiletypes.includes(doc.filetype)) return;
    const buffer = doc.buffer;

    const disabled =
      (await buffer.getVar('coc_lightbulb_disable')) == 1 ||
      (followDiagnostic && (await buffer.getVar('coc_diagnostic_disable')) == 1);

    const show = !disabled && (await lightbulb.show(doc, only));

    /////////////////////
    // clear lightbulb //
    /////////////////////

    buffer.setVar('coc_lightbulb_status', '');
    if (enableVirtualText) buffer.clearNamespace(ns);

    // @ts-ignore
    if (enableSign) buffer.unplaceSign({ group: 'CocLightbulb' });

    //////////////////
    if (!show) return;
    //////////////////

    ////////////////////
    // show lightbulb //
    ////////////////////

    buffer.setVar('coc_lightbulb_status', statusText);

    if (enableVirtualText) {
      const chunks: [string, string][] = [[virtualText, 'LightBulbVirtualText']];
      const state = await workspace.getCurrentState();
      const lnum = state.position.line;

      if (!nvim6) {
        // no more updated this api
        nvim.call('nvim_buf_set_virtual_text', [doc.bufnr, ns, lnum, chunks, {}], true);
      } else {
        let col: number;
        let pos: 'overlay' | 'eol' | 'right_align';
        if (virtualTextPosition == 'auto') {
          const line = state.document.lineAt(lnum);
          const curCol = state.position.character;
          let offset = line.firstNonWhitespaceCharacterIndex;
          // make sure offset <= curCol <= length
          if (curCol < offset) {
            offset = curCol;
          }
          const length = line.text.length;
          if (offset < virtualTextPadding) {
            // left side has no enough area to place virt_text
            // so choose [right] side
            pos = 'eol';
            col = 0;
          } else {
            // Side closest to current cursor
            if (curCol - offset + virtualTextPadding <= length - curCol) {
              // [left]
              pos = 'overlay';
              col = offset - virtualTextPadding;
            } else {
              // If there is already virtual text on the right, choose the left first.
              // This avoid distracting the developer with too much virtual text moving around
              if (await nvim.call('luaeval', [`__coc_lightbulb_check_virt_text_eol(${doc.bufnr}, ${lnum})`])) {
                pos = 'overlay';
                col = offset - virtualTextPadding;
              } else {
                // [right]
                pos = 'eol';
                col = 0;
              }
            }
          }
        } else {
          pos = virtualTextPosition;
          col = 0;
        }
        buffer.setExtMark(ns, lnum, col, {
          hl_mode: 'combine',
          virt_text: chunks,
          virt_text_pos: pos,
          priority: virtualTextPriority,
        });
      }
    }

    if (enableSign)
      // @ts-ignore
      buffer.placeSign({
        lnum: (await workspace.getCurrentState()).position.line + 1,
        name: 'LightBulbSign',
        group: 'CocLightbulb',
      });
  };

  extCtx.subscriptions.push(
    events.on(['CursorHold', 'CursorHoldI'], async () => {
      await refresh();
    })
  );

  setTimeout(refresh, 3000);
}
