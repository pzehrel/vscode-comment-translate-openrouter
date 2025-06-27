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

export function deactivate() {}
