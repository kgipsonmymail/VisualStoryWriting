# Visual Story-Writing: Writing by Manipulating Visual Representations
<img src="demo.gif">

## [Online Demo](https://damienmasson.com/VisualStoryWriting) / [How to build](#how-to-build-and-run) / [Publication](#publication)

This system automatically **visualizes** a story (chronological events, character and their actions and movements) and allows users to **edit** the story by manipulating these visual representations. For example:
- Hover over the timeline allows reviewing the chronology of events and visualizing the movements of the characters
- Connecting two characters suggests edits to the text to reflect the new interaction
- Moving a character suggests edits to the text to reflect the new position
- Reordering the events in the timeline suggests edits to the text to reflect the new chronology

The system relies on AI models (GPT-4o or ChatGLM) to extract the information from the text and suggest edits.


## How to build and run
The code is written in TypeScript and uses React and Vite. To build and run the code, you will need to have Node.js installed on your machine. You can download it [here](https://nodejs.org/en/download/).

### Configuration
Before running the application, you need to configure your API keys. Copy the example configuration file:
```bash
cp public/env-config-example.json public/env-config.json
```

Then edit `public/env-config.json` and add your API keys:
```json
{
  "VITE_DEFAULT_API_PROVIDER": "small",
  "VITE_OPENAI_API_KEY": "your_openai_api_key_here",
  "VITE_CHATGLM_API_KEY": "your_chatglm_api_key_here",
  "VITE_SMALL_API_KEY": "your_small_api_key_here"
}
```

First install the dependencies:
```bash
npm install
```
Then build the code:
```bash
npm run dev
```


## How to use?
After selecting an API provider and entering your API key, you can test Visual Story-Writing using the shortcuts or you can run the studies.
Note that the system was tested and developped for recent versions of **Google Chrome** or **Mozilla Firefox**.


## How to get API keys?
Visual Story-Writing supports both OpenAI and ChatGLM APIs. Choose the one that works best for you:

**OpenAI:**
- Get your API key from: https://platform.openai.com/account/api-keys
- Your key is never stored and the application runs locally

**ChatGLM (智谱AI):**
- Get your API key from: https://open.bigmodel.cn/
- Your key is never stored and the application runs locally

**Small AI:**
- API endpoint: https://ai98.vip/v1/chat/completions
- Your key is never stored and the application runs locally
- Note: Small AI responses are parsed from natural language format


## Can I try without an API key?
The system depends on AI API to work. If you enter an incorrect key, you will still be able to go through the study but executing prompts will yield an error.


## Where are the video tutorials?
From the launcher, you can start the studies to see the exact ordering and video tutorials participants went through.
Alternatively, you can go in the ``public/videos`` to review all the video tutorials.

## Publication
Coming soon!

You can also find the paper on [arXiv](https://arxiv.org/abs/2410.07486)