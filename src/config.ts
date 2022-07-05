import { workspace } from 'coc.nvim';

class Config {
  public only!: string[];
  public excludeFiletypes!: string[];

  public enableVirtualText!: boolean;
  public virtualTextPriority!: number;
  public virtualTextPosition!: 'auto' | 'eol' | 'right_align';
  public virtualTextPadding!: number;

  public enableSign!: boolean;
  public signPriority!: number;

  public followDiagnostic!: boolean;
  public nvim6!: boolean;
  public text!: { default: string; quickfix: string };
  public names!: {
    virtualText: { default: string; quickfix: string };
    sign: { default: string; quickfix: string };
  };

  constructor() {
    this.setConfiguration();
  }

  setConfiguration() {
    const cfg = workspace.getConfiguration('lightbulb');

    this.only = cfg.get<string[]>('only', [])!;
    this.excludeFiletypes = cfg.get<string[]>('excludeFiletypes', [])!;
    this.enableVirtualText =
      workspace.isNvim &&
      workspace.nvim.hasFunction('nvim_buf_set_virtual_text') &&
      cfg.get<boolean>('enableVirtualText')!;

    const textCfg = workspace.getConfiguration('lightbulb.text');

    this.text = {
      default: textCfg.get<string>('default', ''),
      quickfix: textCfg.get<string>('quickfix', ''),
    };

    this.virtualTextPriority = cfg.get<number>('virtualTextPriority')!;
    this.virtualTextPosition = cfg.get<'auto' | 'eol' | 'right_align'>('virtualTextPosition')!;
    this.virtualTextPadding = 2 * Math.max(this.text.default.length, this.text.quickfix.length) + 2;

    this.enableSign = cfg.get<boolean>('enableSign')!;
    this.signPriority = cfg.get<number>('signPriority')!;

    this.followDiagnostic = cfg.get<boolean>('followDiagnostic')!;

    const names = {
      virtualText: { default: 'LightBulbDefaultVirtualText', quickfix: 'LightBulbQuickFixVirtualText' },
      sign: { default: 'LightBulbDefaultSign', quickfix: 'LightBulbQuickFixSign' },
    };

    this.names = names;

    const { nvim } = workspace;
    if (this.enableVirtualText) {
      nvim.command(`hi default ${names.virtualText.default} guifg=#FDD164`, true);
      nvim.command(`hi default link ${names.virtualText.quickfix} ${names.virtualText.default}`, true);
    }
    if (this.enableSign) {
      nvim.command(`hi default ${names.sign.default} guifg=#FDD164`, true);
      nvim.command(`hi default link ${names.sign.quickfix} ${this.names.sign.default}`, true);
      nvim.command(
        `sign define ${names.sign.default} text=${this.text.default.replace(' ', '')} texthl=${
          names.sign.default
        } linehl=${names.sign.default}Line`,
        true
      );
      nvim.command(
        `sign define ${names.sign.quickfix} text=${this.text.quickfix.replace(' ', '')} texthl=${
          names.sign.quickfix
        } linehl=${names.sign.quickfix}Line`,
        true
      );
    }

    const nvim6 = workspace.has('nvim-0.6.0');
    this.nvim6 = nvim6;
    if (nvim6) {
      nvim.lua(`
function _G.__coc_lightbulb_check_virt_text_eol(bufnr, lnum, exclude_ns)
	for _, ns_id in pairs(vim.api.nvim_get_namespaces()) do
		if ns_id ~= exclude_ns then
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
	end
	return false
end
         `);
    }
  }
}

export const config = new Config();
