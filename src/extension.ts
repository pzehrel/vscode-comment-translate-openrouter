import type { ITranslateRegistry } from 'comment-translate-manager'
import type * as vscode from 'vscode'
import { Translater } from './translater'

export function activate(_context: vscode.ExtensionContext) {
  return {
    extendTranslate(register: ITranslateRegistry) {
      register('openrouter', Translater)
    },
  }
}

// 当您的扩展被停用时调用此方法
export function deactivate() {}
