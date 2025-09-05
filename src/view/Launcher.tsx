import { Button, Card, CardBody, CardHeader, Divider, Input, Select, SelectItem } from "@nextui-org/react";
import { useState, useEffect } from "react";
import { MdHistoryEdu } from "react-icons/md";
import { useModelStore, APIType } from '../model/Model';
import { extractedEntitiesToNodeEntities } from "../model/prompts/textExtractors/EntitiesExtractor";
import { extractedLocationsToNodeLocations } from "../model/prompts/textExtractors/LocationsExtractor";
import { extractedActionsToEdgeActions } from "../model/prompts/textExtractors/SentenceActionsExtractor";
import { VisualRefresher } from "../model/prompts/textExtractors/VisualRefresher";
import { dataTextAlice, textAlice } from "../study/data/TextAlice";
import { dataTextB, textB } from "../study/data/TextB";
import { dataTextD, textD } from "../study/data/TextD";
import { useStudyStore } from "../study/StudyModel";

export default function Launcher() {
  const [accessKey, setAccessKey] = useState('');
  const [apiType, setApiType] = useState<APIType>('openai');
  const [pid, setPid] = useState(-1);
  const [hasEnvApiKey, setHasEnvApiKey] = useState(false);
  const setAPIKey = useModelStore((state) => state.setAPIKey);
  const setAPIType = useModelStore((state) => state.setAPIType);
  const getDefaultApiType = useModelStore((state) => state.getDefaultApiType);
  const resetModel = useModelStore((state) => state.reset);
  const resetStudyModel = useStudyStore((state) => state.reset);

  // 初始化时读取环境变量配置
  useEffect(() => {

    // 从公开的配置文件读取环境变量
    fetch('/env-config.json')
      .then(response => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      })
      .then(envConfig => {
        // 使用配置文件中的值
        const defaultApiType = envConfig.VITE_DEFAULT_API_PROVIDER || 'openai';
        const apiKey = envConfig.VITE_SMALL_API_KEY || envConfig.VITE_OPENAI_API_KEY || envConfig.VITE_CHATGLM_API_KEY || '';

        setApiType(defaultApiType);

        if (apiKey && apiKey !== 'your-openai-api-key-here' &&
            apiKey !== 'your-chatglm-api-key-here' &&
            apiKey !== 'your-small-api-key-here') {
          setHasEnvApiKey(true);
          setAccessKey('****'); // 显示占位符
          setAPIType(defaultApiType);
          setAPIKey(apiKey);
        }
      })
      .catch(error => {
        // 回退到 Vite 环境变量
        const defaultApiType = import.meta.env.VITE_DEFAULT_API_PROVIDER || 'openai';
        setApiType(defaultApiType);

        let envApiKey = '';
        if (defaultApiType === 'small' && import.meta.env.VITE_SMALL_API_KEY) {
          envApiKey = import.meta.env.VITE_SMALL_API_KEY;
        }

        if (envApiKey) {
          setHasEnvApiKey(true);
          setAccessKey('****');
          setAPIType(defaultApiType);
          setAPIKey(envApiKey);
        }
      });
  }, []);

  function startExample(text : string, data : any) {
    resetModel();
    resetStudyModel();

    useModelStore.getState().setTextState([{ children: [{text: text }] }], true, false);
    useModelStore.getState().setIsStale(false);
    VisualRefresher.getInstance().previousText = useModelStore.getState().text;
    VisualRefresher.getInstance().onUpdate();

    if (data) {
        const entityNodes = extractedEntitiesToNodeEntities(data);
        const locationNodes = extractedLocationsToNodeLocations(data);
        const actionEdges = data.actions.map((h : any) => extractedActionsToEdgeActions({actions: [h]}, h.passage, entityNodes)).flat();
        useModelStore.getState().setEntityNodes(entityNodes);
        useModelStore.getState().setLocationNodes(locationNodes);
        useModelStore.getState().setActionEdges(actionEdges);
    } else {
        const locationNodes = extractedLocationsToNodeLocations({
            locations: [{
                name: "unknown",
                emoji: "🌍",
            }]
        });

        useModelStore.getState().setLocationNodes(locationNodes);
        useModelStore.getState().setEntityNodes([]);
        useModelStore.getState().setActionEdges([]);
    }

    // 使用实际的API密钥（如果有环境变量配置）
    const actualKey = hasEnvApiKey && accessKey === '****' ? import.meta.env[
        apiType === 'openai' ? 'VITE_OPENAI_API_KEY' :
        apiType === 'chatglm' ? 'VITE_CHATGLM_API_KEY' :
        'VITE_SMALL_API_KEY'
    ] : accessKey;

    window.location.hash = '/free-form' + `?k=${btoa(actualKey)}`;
}

  return <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
    <Card>
        <CardHeader><span style={{fontSize: 25}}><MdHistoryEdu /></span><span style={{marginLeft: 5}}>Visual Story-Writing</span></CardHeader>
        <Divider />
        <CardBody>
            <p>To run the examples below, please select an API provider and paste the corresponding API key.</p>
            {hasEnvApiKey && (
                <div style={{
                    marginTop: 10,
                    padding: 10,
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #0ea5e9',
                    borderRadius: 6,
                    fontSize: '14px',
                    color: '#0c4a6e'
                }}>
                    ✅ <strong>Environment configured:</strong> Using {apiType.toUpperCase()} API from .env file
                </div>
            )}


            <Select
                variant="faded"
                label="API Provider"
                placeholder="Select API provider"
                selectedKeys={[apiType]}
                onChange={(e) => {
                    const newApiType = e.target.value as APIType;
                    setApiType(newApiType);
                    setAPIType(newApiType);
                }}
                style={{marginTop: 10, marginBottom: 10}}
            >
                <SelectItem key="openai" value="openai">OpenAI</SelectItem>
                <SelectItem key="chatglm" value="chatglm">ChatGLM (智谱AI)</SelectItem>
                <SelectItem key="small" value="small">Small AI</SelectItem>
            </Select>

            <Input
                variant="faded"
                label="API Key"
                placeholder={
                    hasEnvApiKey ? "**** (configured via .env)" :
                    apiType === 'openai' ? "sk-..." :
                    apiType === 'chatglm' ? "your-chatglm-key" :
                    "your-small-api-key"
                }
                value={accessKey}
                style={{marginTop: 10}}
                onChange={(e) => {
                    const newValue = e.target.value;
                    setAccessKey(newValue);
                    setHasEnvApiKey(false); // 用户手动输入时清除环境变量标志
                    if (newValue && newValue !== '****') {
                        setAPIKey(newValue);
                    }
                }}
            ></Input>

            <p style={{marginTop: 10, fontSize: '14px', color: '#666'}}>
                {apiType === 'openai'
                    ? 'Get your OpenAI API key from: https://platform.openai.com/account/api-keys'
                    : apiType === 'chatglm'
                    ? 'Get your ChatGLM API key from: https://open.bigmodel.cn/'
                    : 'Small AI API endpoint: https://ai98.vip/v1/chat/completions'
                }
            </p>
        </CardBody>
        <Divider />
        <CardBody>
            <span style={{fontWeight: 800}}>Shortcuts to try out Visual Story-Writing on examples</span>
            <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40, marginTop: 10}}>
                <Button
                isDisabled={!hasEnvApiKey && accessKey.length === 0}
                    onClick={() => {
                        startExample(textAlice, dataTextAlice)
                    }}
                >Alice in Wonderland</Button>
                
                <Button
                isDisabled={!hasEnvApiKey && accessKey.length === 0}
                onClick={() => {
                    startExample(textB, dataTextB)
                }}
                >Sled Adventure</Button>

<Button
                isDisabled={!hasEnvApiKey && accessKey.length === 0}
                onClick={() => {
                    startExample(textD, dataTextD)
                }}
                >Waves Apart</Button>

                <Button
                isDisabled={!hasEnvApiKey && accessKey.length === 0}
                    onClick={() => {
                        startExample("", null);
                    }}
                >Blank Page</Button>
            </div>
        </CardBody>
        <Divider />
        <CardBody>
            <span style={{fontWeight: 800}}>Run study 1</span>
            <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'left', alignItems: 'center', gap: 40, marginTop: 10}}>
                <Select isDisabled={!hasEnvApiKey && accessKey.length === 0}
                variant="faded" label="Participant ID" className="max-w-xs"
                onChange={(e) => setPid(parseInt(e.target.value))}>
                    {
                        Array.from({length: 12}, (_, i) => i).map((i) => <SelectItem key={i} value={i+1} textValue={"P" + (i+1)}>P{i+1}</SelectItem>)
                    }
                </Select>
                <Button
                    isDisabled={(!hasEnvApiKey && accessKey.length === 0) || pid === -1}
                    onClick={() => {
                        resetModel();
                        resetStudyModel();
                        const actualKey = hasEnvApiKey && accessKey === '****' ? import.meta.env[
                            apiType === 'openai' ? 'VITE_OPENAI_API_KEY' :
                            apiType === 'chatglm' ? 'VITE_CHATGLM_API_KEY' :
                            'VITE_SMALL_API_KEY'
                        ] : accessKey;
                        window.location.hash = '/study' + '?pid=' + (pid+1) + `&k=${btoa(actualKey)}` + '&studyType=READING';
                    }}
                >Start</Button>
            </div>
        </CardBody>
        <Divider />
        <CardBody>
            <span style={{fontWeight: 800}}>Run study 2</span>
            <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'left', alignItems: 'center', gap: 40, marginTop: 10}}>
                <Select isDisabled={!hasEnvApiKey && accessKey.length === 0}
                variant="faded" label="Participant ID" className="max-w-xs"
                onChange={(e) => setPid(parseInt(e.target.value))}>
                    {
                        Array.from({length: 12}, (_, i) => i).map((i) => <SelectItem key={i} value={i+1} textValue={"P" + (i+1)}>P{i+1}</SelectItem>)
                    }
                </Select>
                <Button
                    isDisabled={(!hasEnvApiKey && accessKey.length === 0) || pid === -1}
                    onClick={() => {
                        resetModel();
                        resetStudyModel();
                        const actualKey = hasEnvApiKey && accessKey === '****' ? import.meta.env[
                            apiType === 'openai' ? 'VITE_OPENAI_API_KEY' :
                            apiType === 'chatglm' ? 'VITE_CHATGLM_API_KEY' :
                            'VITE_SMALL_API_KEY'
                        ] : accessKey;
                        window.location.hash = '/study' + '?pid=' + (pid+1) + `&k=${btoa(actualKey)}` + '&studyType=WRITING';
                    }}
                >Start</Button>
            </div>
        </CardBody>
    </Card>
    </div>
}