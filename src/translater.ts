import type { ITranslate, ITranslateOptions } from 'comment-translate-manager'
import type { Disposable } from 'vscode'
import { window, workspace } from 'vscode'

interface Config {
  apiKey?: string
  model: string
  api: string
  prompts: {
    system: string
    translate: string
  }
  timeout?: number
}

const CONFIG_NAME = 'openrouterTranslate'

export class Translater implements ITranslate {
  async translate(content: string, options: ITranslateOptions): Promise<string> {
    const { prompts, model, api, apiKey, timeout = 10 * 60 * 1000 } = this.config
    if (!apiKey) {
      throw new Error('Please check the configuration of authKey!')
    }

    const headers = new Headers({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    })

    const payload = {
      model,
      messages: [
        { role: 'system', content: replacePrompt(prompts.system, content, options) },
        { role: 'user', content: replacePrompt(prompts.translate, content, options) },
      ],
    }

    const abort = new AbortController()
    const id = setTimeout(() => abort.abort(new Error('Timeout')), timeout)

    // https://openrouter.ai/request-builder
    const response: Response | Error = await fetch(api, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: abort.signal,
    }).catch(error => error)

    clearTimeout(id)

    if (response instanceof Error) {
      throw response
    }
    if (response.status !== 200) {
      const error = await response.json() as { error: { message: string } }
      throw new Error(error.error.message)
    }

    const body = await response.json() as { choices: { message: { content: string } }[] }
    return body.choices[0].message.content
  }

  link(_content: string, _options: ITranslateOptions): string {
    return `--- what's this?`
  }

  isSupported() {
    return true
  }

  get maxLen(): number {
    return 5000
  }

  private get config(): Config {
    const configuration = workspace.getConfiguration(CONFIG_NAME)
    return {
      apiKey: configuration.get<string>('apiKey'),
      model: configuration.get<string>('model') || 'google/gemini-2.0-flash-exp:free',
      api: configuration.get<string>('api') || 'https://openrouter.ai/api/v1/chat/completions',
      prompts: {
        system: configuration.get<string>('prompts.system') || SYSTEM_PROMPT,
        translate: configuration.get<string>('prompts.user') || TRANSLATE_PROMPT,
      },
    }
  }

  constructor() {
    workspace.onDidChangeConfiguration(async (eventNames) => {
      if (eventNames.affectsConfiguration(CONFIG_NAME)) {
        this.testConnection()
      }
    })
  }

  private async testConnection() {
    const disposables: Disposable[] = []

    const progress = window.createStatusBarItem()
    progress.text = '$(sync~spin) Testing connection...'
    progress.show()
    disposables.push(progress)

    const start = Date.now()
    const result: string | Error = await this.translate('hello', { to: 'zh-Hans' }).catch(err => err)
    if (result instanceof Error) {
      window.showErrorMessage(`[OpenRouter] Connection failed: ${result.message}`)
    }
    else {
      const duration = Date.now() - start
      const action = await window.showInformationMessage(`[OpenRouter] Connection successful in ${duration}ms`, 'Details')
      if (action === 'Details') {
        window.showInformationMessage(`translate result: ${result}`)
      }
    }

    disposables.forEach(disposable => disposable.dispose())
  }
}

function replacePrompt(template: string, content: string, options: ITranslateOptions) {
  const { to = 'zh-Hans' } = options
  return template
    .replace(/\{\{to\}\}/g, to)
    .replace(/\{\{content\}\}/g, content)
    .trim()
}

const SYSTEM_PROMPT = `
You are a professional {{to}} native translator who needs to fluently translate text into {{to}}.
## Translation Rules
1. Output only the translated content, without explanations or additional content (such as "Here's the translation:" or "Translation as follows:")
2. The returned translation must maintain exactly the same number of paragraphs and format as the original text
4. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.
`

const TRANSLATE_PROMPT = `
Translate to {{to}}:

{{content}}
`
