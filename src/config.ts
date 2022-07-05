import { workspace } from 'coc.nvim';

class Config {
  public only!: string[];
  public excludeFiletypes!: string[];
  public enableVirtualText!: boolean;
  public virtualText!: string;
  public virtualTextPriority!: number;
  public virtualTextPosition!: 'auto' | 'eol' | 'right_align';
  public virtualTextPadding!: number;
  public enableSign!: boolean;
  public signText!: string;
  public statusText!: string;
  public followDiagnostic!: boolean;
  public nvim6!: boolean;

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
    this.virtualText = cfg.get<string>('virtualText')!;
    this.virtualTextPriority = cfg.get<number>('virtualTextPriority')!;
    this.virtualTextPosition = cfg.get<'auto' | 'eol' | 'right_align'>('virtualTextPosition')!;
    this.virtualTextPadding = 2 * this.virtualText.length + 2;
    this.enableSign = cfg.get<boolean>('enableSign')!;
    this.signText = cfg.get<string>('signText')!;
    this.statusText = cfg.get<string>('statusText')!;
    this.followDiagnostic = cfg.get<boolean>('followDiagnostic')!;

    const { nvim } = workspace;
    if (this.enableVirtualText) nvim.command('hi default LightBulbVirtualText guifg=#FDD164', true);
    if (this.enableSign) {
      nvim.command('hi default LightBulbSign guifg=#FDD164', true);
      nvim.command(
        `sign define LightBulbSign text=${this.signText.replace(
          ' ',
          ''
        )} texthl=LightBulbSign linehl=LightBulbSignLine`,
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
