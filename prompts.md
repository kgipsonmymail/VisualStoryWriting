

使用体验：
1. 很有趣的地方是，通过cursor，可以对项目二次开发，本来支持openai的api接口，现在可以支持其他openai类接口（只需要换url和apikey的），但是如果不用gpt-4o模型，很容易出错，包括chatglm4.5也因为格式上受限，无法成功实现原来的效果。
2. 但是二次开发需要投入时间，自己开发的话，进度缓慢，而且也因为AI开发，也容易出bug。
3. 期待官方继续出原功能，不过估计吧，他们论文都发表了，不知道有没有兴趣继续做。


现在npm run dev启动特别慢，能不能通过配置让它run build，方便下次启动？
F:\sys\o\OneDrive - LightGroup\programs\5_learn\ghandhf\VisualStoryWriting>npm run build

> visualstorywriting@0.0.0 build
> NODE_ENV=development vite build --mode development --base=/VisualStoryWriting

'NODE_ENV' is not recognized as an internal or external command,
operable program or batch file.


阅读 项目说明，帮我找到api接口的部分，把格式改为兼容chatglm 来源的api

原来的库是通过什么方法实现openai的api调用的？我们可以如何替换掉？但你不用删掉原来的连接方式


import requests

url = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

payload = {
    "model": "glm-4.5",
    "messages": [
        {
            "role": "system",
            "content": "你是一个有用的AI助手。"
        },
        {
            "role": "user",
            "content": "请介绍一下人工智能的发展历程。"
        }
    ],
    "temperature": 0.6,
    "max_tokens": 1024,
    "stream": False
}
headers = {
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)

print(response.json())

curl --request POST \
  --url https://open.bigmodel.cn/api/paas/v4/chat/completions \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
  "model": "glm-4.5",
  "messages": [
    {
      "role": "system",
      "content": "你是一个有用的AI助手。"
    },
    {
      "role": "user",
      "content": "请介绍一下人工智能的发展历程。"
    }
  ],
  "temperature": 0.6,
  "max_tokens": 1024,
  "stream": false
}'

const url = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const options = {
  method: 'POST',
  headers: {Authorization: 'Bearer <token>', 'Content-Type': 'application/json'},
  body: '{"model":"glm-4.5","messages":[{"role":"system","content":"你是一个有用的AI助手。"},{"role":"user","content":"请介绍一下人工智能的发展历程。"}],"temperature":0.6,"max_tokens":1024,"stream":false}'
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}