import {
  CancellationTokenSource,
  CodeActionContext,
  diagnosticManager,
  Document,
  events,
  ExtensionContext,
  languages,
  workspace,
} from 'coc.nvim';
import { CodeAction, CodeActionKind } from 'vscode-languageserver-protocol';

export class Lightbulb {
  private tokenSource: CancellationTokenSource | undefined;

  async show(doc?: Document, only?: CodeActionKind[]): Promise<boolean> {
    this.tokenSource?.cancel();
    this.tokenSource = new CancellationTokenSource();
    const token = this.tokenSource.token;

    if (!doc) {
      doc = await workspace.document;
    }
    const range = await workspace.getSelectedRange('cursor', doc);

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

const ns = workspace.createNameSpace('coc-lightbulb');
const lightbulb = new Lightbulb();

export async function activate(extCtx: ExtensionContext): Promise<void> {
  const config = workspace.getConfiguration('lightbulb');
  const enableVirtualText = config.get<boolean>('enableVirtualText');
  const virtualText = config.get<string>('virtualText')!;
  const statusText = config.get<string>('statusText')!;
  const only = config.get<string[]>('only', [])!;

  await workspace.nvim.command('hi default LightBulbVirtualText guifg=#FDD164');

  extCtx.subscriptions.push(
    events.on(['CursorHold', 'CursorHoldI'], async () => {
      const doc = await workspace.document;
      const buffer = doc.buffer;

      // clear all states
      buffer.setVar('coc_lightbulb_status', '');
      buffer.clearNamespace(ns);

      const show = await lightbulb.show(doc, only);

      if (!show) return;

      // status text
      buffer.setVar('coc_lightbulb_status', statusText);

      // virtual text
      if (enableVirtualText) {
        const line = (await workspace.getCurrentState()).position.line;
        buffer.setVirtualText(ns, line, [[virtualText, 'LightBulbVirtualText']]);
      }
    })
  );
}
