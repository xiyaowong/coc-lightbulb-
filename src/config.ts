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
      default: textCfg.get<string>('default', '󰌵'),
      quickfix: textCfg.get<string>('quickfix', '󰁨'),
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

    this.nvim6 = workspace.has('nvim-0.6.0');
    if (this.nvim6) {
      nvim.createNamespace('coc-lightbulb').then((ns) => {
        // TODO: check window view overflow
        const code = `
local ffi = require("ffi")
local api = vim.api

ffi.cdef("int curwin_col_off(void);")
---@diagnostic disable-next-line: undefined-field
local curwin_col_off = ffi.C.curwin_col_off

function _G.__coc_lightbulb_is_eol_suitable()
	local finish = vim.fn.col("$") - 1
	local curCol = vim.fn.col(".") - 1

	if finish - curCol > 30 or finish + curwin_col_off() + ${this.virtualTextPadding} > api.nvim_win_get_width(0) then
		return false
	end

	local lnum = vim.fn.line(".") - 1

	for _, ns in pairs(api.nvim_get_namespaces()) do
		if ns ~= ${ns} then
			local marks = api.nvim_buf_get_extmarks(0, ns, { lnum, 0 }, { lnum, -1 }, { details = true })
			if #marks > 0 then
				for _, mark in ipairs(marks) do
					local details = mark[4]
					if details.virt_text and details.virt_text_pos == "eol" then
						return false
					end
				end
			end
		end
	end
	return true
end
         `;
        nvim.lua(code);
      });
    }
  }
}

export const config = new Config();
