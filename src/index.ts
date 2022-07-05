import { events, ExtensionContext, workspace } from 'coc.nvim';
import { config } from './config';
import { lightbulb } from './lightbulb';

export async function activate(extCtx: ExtensionContext): Promise<void> {
  extCtx.subscriptions.push(
    workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('lightbulb')) {
        config.setConfiguration();
        await lightbulb.refresh(true);
      }
    }),
    events.on(['CursorHold', 'CursorHoldI'], async () => {
      await lightbulb.refresh();
    })
  );

  setTimeout(async () => {
    await lightbulb.refresh();
  }, 3000);
}
