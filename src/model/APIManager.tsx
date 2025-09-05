import OpenAI from 'openai';

export type APIType = 'openai' | 'chatglm' | 'small';

class APIManager {
  private client: OpenAI | null = null;
  private currentAPI: APIType = 'openai';
  private apiKey: string | null = null;

  constructor() {
    // 初始化时不创建客户端，等待设置API密钥时再创建
  }

  setAPIType(apiType: APIType) {
    this.currentAPI = apiType;
    // 如果已经有API密钥，则重新初始化客户端
    if (this.apiKey) {
      this.initializeClient();
    }
  }

  getCurrentAPI(): APIType {
    return this.currentAPI;
  }

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    this.initializeClient();
  }

  private initializeClient() {
    if (!this.apiKey) return;

    if (this.currentAPI === 'openai') {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true
      });
    } else if (this.currentAPI === 'chatglm') {
      // 使用OpenAI库但配置为ChatGLM的endpoint
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        dangerouslyAllowBrowser: true
      });
    } else if (this.currentAPI === 'small') {
      // 使用small API endpoint
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: 'https://ai98.vip/v1',
        dangerouslyAllowBrowser: true
      });
    }
  }

  async createChatCompletion(request: any): Promise<any> {
    if (!this.client) {
      throw new Error('API client not initialized. Please set API key first.');
    }
    return await this.client.chat.completions.create(request);
  }

  async *createChatCompletionStream(request: any): AsyncGenerator<any> {
    if (!this.client) {
      throw new Error('API client not initialized. Please set API key first.');
    }
    const stream = await this.client.chat.completions.create({
      ...request,
      stream: true,
    });
    yield* stream;
  }

  // 获取默认模型名称
  getDefaultModel(): string {
    switch (this.currentAPI) {
      case 'openai':
        return 'gpt-4o-2024-08-06';
      case 'chatglm':
        return 'glm-4.5';
      case 'small':
        return 'gpt-4o-2024-08-06'; // small API通常支持gpt-4o
      default:
        return 'gpt-4o-2024-08-06';
    }
  }

  // 获取默认温度参数
  getDefaultTemperature(): number {
    switch (this.currentAPI) {
      case 'openai':
        return 0;
      case 'chatglm':
        return 0.6;
      case 'small':
        return 0.7; // small API可以使用稍高的温度
      default:
        return 0.7;
    }
  }

  // 获取默认最大token数
  getDefaultMaxTokens(): number {
    switch (this.currentAPI) {
      case 'openai':
        return 4096;
      case 'chatglm':
        return 1024;
      case 'small':
        return 2048; // small API的token限制
      default:
        return 2048;
    }
  }
}

export const apiManager = new APIManager();
