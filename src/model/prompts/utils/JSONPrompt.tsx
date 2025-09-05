import { Allow, parse } from "partial-json";
import { ZodObject, z } from "zod";
import { useStudyStore } from "../../../study/StudyModel";
import { apiManager } from "../../APIManager";
import { BasePrompt, ExecutablePrompt, PromptResult } from "./BasePrompt";


export class JSONPrompt<T> extends BasePrompt<PromptResult<T>> {
  prompt: ExecutablePrompt;
  schema: z.ZodType<T>;
  optionalSchema: ZodObject<any> | null;
  onPartialResponse: null | ((partialResult: PromptResult<T>) => void);
  maxRetries: number = 2;

  constructor(prompt: ExecutablePrompt, schema: z.ZodType<T>) {
    super();
    this.prompt = prompt;
    this.schema = schema;
    this.optionalSchema = null;
    this.onPartialResponse = null;
  }

  getDefaultValue(field: z.ZodTypeAny): any {
    if (field instanceof z.ZodString) {
      return '';
    } else if (field instanceof z.ZodNumber) {
      return 0;
    } else if (field instanceof z.ZodBoolean) {
      return false;
    } else {
      // Default fallback for other types (e.g., ZodUnion, ZodEnum)
      return null;
    }
  };


  addMissingFields(partialResponse: any, schema: z.ZodType): any {
    const emptyObject = (schema as any as z.ZodObject<any>).shape;

    const filledData = Object.keys(emptyObject).reduce((acc, key) => {
      if (emptyObject[key] instanceof z.ZodObject) {
        acc[key] = this.addMissingFields(partialResponse[key] || {}, emptyObject[key]);
      } else if (emptyObject[key] instanceof z.ZodArray) {
        acc[key] = (partialResponse[key] || []).map((item: any) => this.addMissingFields(item, emptyObject[key].element));
      } else {
        acc[key] = partialResponse.hasOwnProperty(key) ? partialResponse[key] : this.getDefaultValue(emptyObject[key]);
      }
      return acc;
    }, {} as Record<string, z.ZodTypeAny>);


    return filledData;
  }

  partialParse(response: string): T | null {
    try {
      // For Small API, try to parse JSON with markdown cleanup first
      if (apiManager.getCurrentAPI() === 'small') {
        // Clean markdown code blocks
        let cleanResponse = response.trim();
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');

        // Check if response is empty or just braces
        if (cleanResponse === '{}' || cleanResponse === '' || cleanResponse.length < 3) {
          console.log("Received empty or invalid response from Small API:", cleanResponse);
          return null;
        }

        try {
          const parsedResult = JSON.parse(cleanResponse) as T;
          return this.schema.parse(this.addMissingFields(parsedResult, this.schema));
        } catch (jsonError) {
          // If JSON parsing fails, try natural language parsing
          const naturalLanguageResult = this.parseNaturalLanguageResponse(response);
          if (naturalLanguageResult) {
            return naturalLanguageResult;
          }
        }
      }

      // Partial parse
      let partialResponse = parse(response, ~Allow.STR);
      // Try adding missing values to the partial response using sensible defaults
      return this.schema.parse(this.addMissingFields(partialResponse, this.schema)); // Should add the missing fields
    } catch (e) {
      // Do nothing if we could not parse the partial response
      /*if (e instanceof z.ZodError) {
        console.log(e.issues);
      }
      console.error("Partial parse error for ", response, e);*/
      console.log("Partial parse failed for response:", response.substring(0, 200));
    }
    return null;
  }

  // Parse natural language response from Small API
  private parseNaturalLanguageResponse(response: string): T | null {
    try {
      // Try to extract structured data from Small API's natural language format
      if (response.includes("locations") || response.includes("location")) {
        return this.parseLocationsResponse(response) as T;
      } else if (response.includes("entities") || response.includes("entity")) {
        return this.parseEntitiesResponse(response) as T;
      }
      return null;
    } catch (e) {
      console.warn("Failed to parse natural language response:", e);
      return null;
    }
  }

  private parseLocationsResponse(response: string): any {
    const locations: any[] = [];
    // Parse numbered list format like "1. **Name** - emoji"
    const locationRegex = /(\d+)\.\s*\*\*([^*]+)\*\*\s*-\s*([^\n]+)/g;
    let match;

    while ((match = locationRegex.exec(response)) !== null) {
      const [, , name, emoji] = match;
      locations.push({
        name: name.trim(),
        emoji: emoji.trim()
      });
    }

    return { locations };
  }

  private parseEntitiesResponse(response: string): any {
    const entities: any[] = [];
    // Parse entity format
    const entityBlocks = response.split(/\d+\.\s*\*\*Entity:\*\*/);

    for (const block of entityBlocks.slice(1)) { // Skip first empty element
      const lines = block.trim().split('\n');
      if (lines.length >= 3) {
        const nameLine = lines[0].trim();
        const emojiLine = lines[1].replace(/\*\*Emoji:\*\*/, '').trim();
        const properties: any[] = [];

        // Parse properties
        for (let i = 2; i < lines.length; i++) {
          const propMatch = lines[i].match(/- ([^:]+):\s*(\d+)/);
          if (propMatch) {
            properties.push({
              name: propMatch[1].trim(),
              value: parseInt(propMatch[2])
            });
          }
        }

        entities.push({
          name: nameLine,
          emoji: emojiLine,
          properties: properties
        });
      }
    }

    return { entities };
  }



  execute(): Promise<PromptResult<T>> {
    return new Promise<PromptResult<T>>((resolve, reject) => {
      this.executeWithRetry(resolve, reject, 0);
    });
  }

  private executeWithRetry(resolve: (value: PromptResult<T>) => void, reject: (reason: any) => void, attempt: number): void {
      (async () => {
        try {
          useStudyStore.getState().logEvent("PROMPT_TO_EXECUTE", { prompt: this.prompt.prompt });

          const model = this.prompt.model || apiManager.getDefaultModel();
          const temperature = apiManager.getDefaultTemperature();
          const maxTokens = apiManager.getDefaultMaxTokens();

          // 根据API类型调整prompt
          let enhancedPrompt = this.prompt.prompt;
          if (apiManager.getCurrentAPI() === 'chatglm') {
            // 为ChatGLM添加JSON格式指令
            const jsonInstruction = "\n\n请以有效的JSON格式回复。确保回复是完整的JSON对象，不要包含其他文本。";
            enhancedPrompt = this.prompt.prompt + jsonInstruction;
          } else if (apiManager.getCurrentAPI() === 'small') {
            // 为Small API添加强制纯JSON格式指令
            const jsonInstruction = "\n\nCRITICAL: Respond with pure JSON only. No markdown, no code blocks, no explanations. Start directly with { and end with }. No ```json or any other formatting.";
            enhancedPrompt = this.prompt.prompt + jsonInstruction;
          }

          const request: any = {
            model: model,
            messages: [{ role: 'user', content: enhancedPrompt }],
            stream: true,
            temperature: temperature,
            max_tokens: maxTokens,
          };

          // 对于ChatGLM，使用prompt指令；对于OpenAI，使用response_format
          if (apiManager.getCurrentAPI() === 'openai') {
            // 重新导入zodResponseFormat，因为我们在条件中使用
            const { zodResponseFormat } = await import('openai/helpers/zod');
            request.response_format = zodResponseFormat(this.schema, "response");
          }

          const stream = apiManager.createChatCompletionStream(request);
          let response = '';

          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            response += content;
            if (this.onPartialResponse) {
              const partialResult = this.partialParse(response);
              if (partialResult) {
                this.onPartialResponse({ result: partialResult });
              }
            }
          }

          useStudyStore.getState().logEvent("PROMPT_EXECUTED", { prompt: this.prompt.prompt, response: response });
          this.onPartialResponse = null; // Reset the partial response callback

          // Debug: Log response format for troubleshooting
          if (apiManager.getCurrentAPI() === 'chatglm' || apiManager.getCurrentAPI() === 'small') {
            console.log(`${apiManager.getCurrentAPI().toUpperCase()} Response:`, response);
            console.log('Response length:', response.length);
            console.log('Response starts with:', response.substring(0, 100));
          }

          // Try to parse the JSON response
          try {
            // First, clean the response by removing markdown code blocks
            let cleanResponse = response.trim();

            // Remove markdown code block syntax for Small API
            if (apiManager.getCurrentAPI() === 'small') {
              cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            }

            const parsedResult = JSON.parse(cleanResponse) as T;
            resolve({ result: parsedResult });
          } catch (parseError) {
            // For Small API, try to parse natural language response
            if (apiManager.getCurrentAPI() === 'small') {
              const naturalLanguageResult = this.parseNaturalLanguageResponse(response);
              if (naturalLanguageResult) {
                console.log('Successfully parsed Small API natural language response');
                resolve({ result: naturalLanguageResult });
                return;
              }
            }
            // If direct parsing fails, try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const parsedResult = JSON.parse(jsonMatch[0]) as T;
                resolve({ result: parsedResult });
              } catch (extractError) {
                console.warn('JSON extraction also failed:', extractError);
                reject(new Error(`Failed to parse JSON response: ${response}`));
              }
            } else {
              console.warn('No JSON found in response:', response);
              if (apiManager.getCurrentAPI() === 'chatglm' || apiManager.getCurrentAPI() === 'small') {
                console.warn(`${apiManager.getCurrentAPI().toUpperCase()} response format may differ from OpenAI. Consider adjusting the prompt or response parsing logic.`);
              }
              reject(new Error(`No JSON found in response: ${response}`));
            }
          }
        } catch (error) {
          // 如果还有重试次数，则重试
          if (attempt < this.maxRetries) {
            console.warn(`JSONPrompt attempt ${attempt + 1} failed, retrying...`, error);
            setTimeout(() => {
              this.executeWithRetry(resolve, reject, attempt + 1);
            }, 1000 * (attempt + 1)); // 递增延迟
          } else {
            reject(error);
          }
        }
      })();
  }
}