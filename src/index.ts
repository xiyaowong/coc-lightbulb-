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
  const only = config.get<string[]>('only', [])!;
  const excludeFiletypes = config.get<string[]>('excludeFiletypes', [])!;
  const enableVirtualText = config.get<boolean>('enableVirtualText');
  const virtualText = config.get<string>('virtualText')!;
  const enableSign = config.get<boolean>('enableSign');
  const signText = config.get<string>('signText')!;
  const statusText = config.get<string>('statusText')!;

  const nvim = workspace.nvim;
  if (enableVirtualText) await nvim.command('hi default LightBulbVirtualText guifg=#FDD164');
  if (enableSign) {
    await nvim.command('hi default LightBulbSign guifg=#FDD164');
    await nvim.command(
      `sign define LightBulbSign text=${signText.replace(' ', '')} texthl=LightBulbSign linehl=LightBulbSignLine`
    );
  }

  extCtx.subscriptions.push(
    events.on(['CursorHold', 'CursorHoldI'], async () => {
      const doc = await workspace.document;
      if (excludeFiletypes.includes(doc.filetype)) return;
      const buffer = doc.buffer;

      // clear lightbulb
      buffer.setVar('coc_lightbulb_status', '');
      if (enableVirtualText) buffer.clearNamespace(ns);
      // @ts-ignore
      if (enableSign) buffer.unplaceSign({ group: 'CocLightbulb' });

      if (!(await lightbulb.show(doc, only))) return;

      // show lightbulb
      buffer.setVar('coc_lightbulb_status', statusText);
      if (enableVirtualText)
        buffer.setVirtualText(ns, (await workspace.getCurrentState()).position.line, [
          [virtualText, 'LightBulbVirtualText'],
        ]);
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
