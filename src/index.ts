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
  const enableVirtualText = config.get<boolean>('enableVirtualText');
  const virtualText = config.get<string>('virtualText')!;
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

  const ns = await nvim.createNamespace('coc-lightbulb');
  const lightbulb = new Lightbulb();

  extCtx.subscriptions.push(
    events.on(['CursorHold', 'CursorHoldI'], async () => {
      const doc = await workspace.document;
      if (!doc || !doc.attached) return;
      if (excludeFiletypes.includes(doc.filetype)) return;
      const buffer = doc.buffer;

      // clear lightbulb
      //////////////////

      buffer.setVar('coc_lightbulb_status', '');

      if (enableVirtualText) buffer.clearNamespace(ns);

      // @ts-ignore
      if (enableSign) buffer.unplaceSign({ group: 'CocLightbulb' });

      if (
        (await buffer.getVar('coc_lightbulb_disable')) == 1 ||
        (followDiagnostic && (await buffer.getVar('coc_diagnostic_disable')) == 1)
      )
        return;

      if (!(await lightbulb.show(doc, only))) return;

      // show lightbulb
      /////////////////

      buffer.setVar('coc_lightbulb_status', statusText);

      if (enableVirtualText)
        nvim.call(
          'nvim_buf_set_virtual_text',
          [
            doc.bufnr,
            ns,
            (await workspace.getCurrentState()).position.line,
            [[virtualText, 'LightBulbVirtualText']],
            {},
          ],
          true
        );

      if (enableSign)
        // @ts-ignore
        buffer.placeSign({
          lnum: (await workspace.getCurrentState()).position.line + 1,
          name: 'LightBulbSign',
          group: 'CocLightbulb',
        });
    })
  );
}
