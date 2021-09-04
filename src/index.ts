import {
  CancellationTokenSource,
  diagnosticManager,
  Document,
  events,
  ExtensionContext,
  languages,
  workspace,
} from 'coc.nvim';
import { CodeAction } from 'vscode-languageserver-protocol';

export class Lightbulb {
  private tokenSource: CancellationTokenSource | undefined;

  async show(doc?: Document): Promise<boolean> {
    this.tokenSource?.cancel();
    this.tokenSource = new CancellationTokenSource();
    const token = this.tokenSource.token;

    doc = doc ?? (await workspace.document);
    const range = await workspace.getSelectedRange('cursor', doc);

    if (!range) return false;

    const diagnostics = diagnosticManager.getDiagnosticsInRange(doc.textDocument, range);
    const context = { diagnostics };

    // @ts-ignore
    let codeActions: CodeAction[] = await languages.getCodeActions(doc.textDocument, range, context, token);

    if (!codeActions || codeActions.length == 0) return false;
    codeActions = codeActions.filter((o) => !o.disabled);
    return codeActions.length > 0;
  }
}

const ns = workspace.createNameSpace('coc-lightbulb');
const lightbulb = new Lightbulb();

export async function activate(extCtx: ExtensionContext): Promise<void> {
  const config = workspace.getConfiguration('lightbulb');
  const enableVirtualText = config.get<boolean>('enableVirtualText');
  const virtualText = config.get<string>('virtualText')!;
  const statusText = config.get<string>('statusText')!;

  await workspace.nvim.command('hi default LightBulbVirtualText guifg=#FDD164');

  extCtx.subscriptions.push(
    events.on(['CursorHold', 'CursorHoldI'], async () => {
      const doc = await workspace.document;
      const buffer = doc.buffer;
      const line = (await workspace.getCurrentState()).position.line;

      const show = await lightbulb.show();

      // status text
      buffer.setVar('coc_lightbulb_status', show ? statusText : '');

      // virtual text
      buffer.clearNamespace(ns);
      if (show && enableVirtualText) {
        buffer.setVirtualText(ns, line, [[virtualText, 'LightBulbVirtualText']]);
      }
    })
  );
}
