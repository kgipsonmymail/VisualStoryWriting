import { apiManager } from "../../APIManager";
import { BasePrompt, ExecutablePrompt, PromptResult } from "./BasePrompt";

export class TextPrompt extends BasePrompt<PromptResult<string>> {
    prompt: ExecutablePrompt;
    onPartialResponse: null | ((partialResult : PromptResult<string>) => void);
    constructor(prompt: ExecutablePrompt) {
        super();
        this.prompt = prompt;
        this.onPartialResponse = null
    }

    execute(): Promise<PromptResult<string>> {
        return new Promise<PromptResult<string>>((resolve, reject) => {

            (async () => {
                try {
                    const model = this.prompt.model || apiManager.getDefaultModel();
                    const temperature = apiManager.getDefaultTemperature();
                    const maxTokens = apiManager.getDefaultMaxTokens();

                    const request = {
                      model: model,
                      messages: [{ role: 'user', content: this.prompt.prompt }],
                      temperature: temperature,
                      stream: true,
                      max_tokens: maxTokens,
                    };

                    const stream = apiManager.createChatCompletionStream(request);
                    let response = '';
                    for await (const chunk of stream) {
                      const content = chunk.choices[0]?.delta?.content || '';
                      response += content;
                      if (this.onPartialResponse) {
                        this.onPartialResponse({ result: response });
                      }
                    }
                    resolve({ result: response });
                } catch (error) {
                    reject(error);
                }
              })();

        });
    }
}