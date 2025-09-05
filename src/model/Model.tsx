import { Edge, Node } from '@xyflow/react';
import * as Diff from 'diff';
import { apiManager, APIType } from './APIManager';
import { Descendant, Node as SlateNode } from 'slate';
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { useStudyStore } from '../study/StudyModel';
import { dataTextD } from '../study/data/TextD';
import { globalEditor } from '../view/TextEditor';
import { useHistoryModelStore } from './HistoryModel';
import { SlateUtils } from './SlateUtils';
import { TextActionMatch, TextUtils } from './TextUtils';
import { extractedEntitiesToNodeEntities } from './prompts/textExtractors/EntitiesExtractor';
import { extractedLocationsToNodeLocations } from './prompts/textExtractors/LocationsExtractor';
import { extractedActionsToEdgeActions } from './prompts/textExtractors/SentenceActionsExtractor';

const hashSplitted = window.location.hash.split("?");
const search = hashSplitted[hashSplitted.length-1]
const params = new URLSearchParams(search);
const key = params.get('k');

let apiKey = ""
let defaultApiType: APIType = 'openai'

// 从环境变量读取默认API类型
if ("VITE_DEFAULT_API_PROVIDER" in import.meta.env) {
    const envApiType = import.meta.env.VITE_DEFAULT_API_PROVIDER as APIType;
    if (['openai', 'chatglm', 'small'].includes(envApiType)) {
        defaultApiType = envApiType;
    }
}

if (!key) {
    // 根据默认API类型从环境变量读取对应的API密钥
    if (defaultApiType === 'openai' && "VITE_OPENAI_API_KEY" in import.meta.env) {
        apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    } else if (defaultApiType === 'chatglm' && "VITE_CHATGLM_API_KEY" in import.meta.env) {
        apiKey = import.meta.env.VITE_CHATGLM_API_KEY;
    } else if (defaultApiType === 'small' && "VITE_SMALL_API_KEY" in import.meta.env) {
        apiKey = import.meta.env.VITE_SMALL_API_KEY;
    }
} else {
    apiKey = atob(key)
}

// 初始化API管理器 - 延迟到API类型设置之后
if (apiKey) {
    // 存储密钥，但不立即初始化客户端
    // 等到setAPIType被调用后再初始化
}

export interface EntityProperty {
    name: string
    value: number
}

export type Entity = {
    name: string
    emoji: string
    properties: EntityProperty[]
}
export type EntityNode = Node<Entity>;

export type Action = {
    name: string
    sourceLocation: string
    targetLocation: string
    passage: string
}
export type ActionEdge = Edge<Action>;

export type Location = {
    name: string
    emoji: string
}
export type LocationNode = Node<Location>;

const hardcodedText = `Anna sat on the beach, watching the waves crash against the shore. The wind blew her hair around, but she didn’t mind. She loved the sound of the ocean. It helped her forget her worries, at least for a little while. She had been thinking about her brother, David, who lived far away. They hadn’t spoken in weeks, and she missed him.

David was in the city, sitting at his desk, staring at his computer. He was tired from a long day of work. His job was stressful, and he often felt lonely in the big, noisy city. He wanted to call Anna, but he was afraid she might be too busy. He knew she was going through a tough time, and he didn’t want to add to her troubles.

Meanwhile, their friend Emma was in the mountains, hiking up a trail. She loved the peacefulness of nature. The trees were tall, and the air was fresh. As she reached the top of the hill, she thought about Anna and David. They used to do everything together, but now they were all in different places. She hoped they could reunite soon, even if just for a little while.`

const hardcodedData = dataTextD

/** 
 * Model 
 **/
export interface ModelState {
    entityNodes: EntityNode[];
    locationNodes: LocationNode[];
    actionEdges: ActionEdge[];
    textState: Descendant[];
    text: string;
    suggestModeUntilTimestamp: number;
    selectedNodes: string[];
    selectedEdges: string[];
    textActionMatches: TextActionMatch[];
    isStale: boolean;
    isReadOnly: boolean;
    apiType: APIType;

    highlightedActionsSegment: { start: number, end: number } | null;
    filteredActionsSegment: { start: number, end: number } | null;

    highlightedEntities: string[];
}

interface ModelAction {
    reset: () => void;
    getFilteredEntityNodes: (actionFilter: { start: number, end: number } | null) => EntityNode[];
    getFilteredActionEdges: (actionFilter: { start: number, end: number } | null) => ActionEdge[];
    getFilteredLocationNodes: (actionFilter: { start: number, end: number } | null) => LocationNode[];
    setEntityNodes: (nodes: EntityNode[]) => void;
    setActionEdges: (edges: ActionEdge[]) => void;
    setLocationNodes: (nodes: LocationNode[]) => void;
    setTextState: (textState: Descendant[], updateEditor?: boolean, addHistoryNode?: boolean) => void;
    suggestNextTextChanges: () => void;
    acceptSuggestions: () => void;
    rejectSuggestions: () => void;
    isTextSuggested: () => boolean;
    setSelectedNodes: (nodes: string[]) => void;
    setSelectedEdges: (edges: string[]) => void;
    setHighlightedActionsSegment: (startActionId: number | null, endActionId: number | null) => void;
    setFilteredActionsSegment: (startActionId: number | null, endActionId: number | null) => void;
    setHighlightedEntities: (entities: string[]) => void;

    setIsStale: (isStale: boolean) => void;
    setAPIKey: (key: string) => void;
    setAPIType: (apiType: APIType) => void;
    setIsReadOnly: (isReadOnly: boolean) => void;
}


function getInitialState() {
    const initialTextState = [
        {
            children: [{
                text: hardcodedText }]
        },
    ]

    const text = SlateUtils.stateToText(initialTextState);;
    const entityNodes = extractedEntitiesToNodeEntities(hardcodedData);
    const locationNodes = extractedLocationsToNodeLocations(hardcodedData);
    const actionEdges = hardcodedData.actions.map(h => extractedActionsToEdgeActions({actions: [h]}, h.passage, entityNodes)).flat();

    
    const initialState: ModelState = {
        entityNodes: entityNodes,
        actionEdges: actionEdges,
        locationNodes: locationNodes,
        suggestModeUntilTimestamp: 0,
        selectedNodes: [],
        selectedEdges: [],
        isStale: false,
        apiType: 'openai', // 默认使用OpenAI
        highlightedActionsSegment: null,
        filteredActionsSegment: null,
        highlightedEntities: [],
        textActionMatches: TextUtils.matchActionsToText(actionEdges.map((edge) => edge.data!), text),
        textState: initialTextState,
        text: text,
        isReadOnly: false
    }

    return initialState;
}

export const useModelStore = create<ModelState & ModelAction>()((set, get) => ({
    ...getInitialState(),
    reset: () => set((state) => ({ ...getInitialState() })),
    getFilteredEntityNodes: (actionFilter: { start: number, end: number } | null) => {
        if (actionFilter === null || actionFilter.start === 0 && actionFilter.end === get().actionEdges.length - 1) {
            return get().entityNodes;
        }
        // Filter to only keep the nodes that are not filtered out
        const filteredIds = get().getFilteredActionEdges(actionFilter).map((edge) => [edge.source, edge.target]).flat();
        return get().entityNodes.filter((node) => filteredIds.includes(node.id));
    },
    getFilteredActionEdges: (actionFilter: { start: number, end: number } | null) => {
        const startIdx = actionFilter !== null ? Math.min(get().actionEdges.length, actionFilter.start) : 0;
        const endIdx = actionFilter !== null ? Math.min(get().actionEdges.length, actionFilter.end + 1) : get().actionEdges.length;

        return get().actionEdges.slice(startIdx, endIdx);
    },
    getFilteredLocationNodes: (actionFilter: { start: number, end: number } | null) => {
        // Filter to only keep the nodes that are not filtered out
        const filteredLocations = get().getFilteredActionEdges(actionFilter).map((edge) => [edge.data!.sourceLocation, edge.data!.targetLocation]).flat();
        return get().locationNodes.filter((node) => filteredLocations.includes(node.data.name));
    },
    setEntityNodes: (nodes) => {
        set((state) => ({ entityNodes: nodes }))
    },
    setLocationNodes: (nodes) => {
        set((state) => ({ locationNodes: nodes }))
    },
    setActionEdges: (edges) =>  {
        // Find the position of the actions in the text
        const textActionMatches = TextUtils.matchActionsToText(edges.map((edge) => edge.data!), get().text);
        set((state) => ({ actionEdges: edges, textActionMatches: textActionMatches }));
    },
    setTextState: (textState, updateEditor = true, addHistoryNode = true) => {
        const text = SlateUtils.stateToText(textState);
        const isTextDifferent = get().text !== text;

        if (isTextDifferent && get().suggestModeUntilTimestamp > Date.now()) {
            // We are in suggestion mode, we should mark the changes as suggestions
            // Calculate the differences and create the marks
            const differences = Diff.diffWordsWithSpace(get().text, text);
            // Construct the new state that highlights the differences
            const newState: Descendant[] = [];

            for (const difference of differences) {
                if (difference.removed) {
                    newState.push({ text: difference.value, removed: true } as any);
                } else if (difference.added) {
                    newState.push({ text: difference.value, added: true } as any);
                } else {
                    // No modification to this word, it stays the same
                    newState.push({ text: difference.value } as any);
                }
            }

            textState = [{ children: newState, type: "paragraph" } as any];
        }
        
        if (isTextDifferent) {
            // Update the text and the position of the actions in the text (at least do it as best it can)
            const textActionMatches = TextUtils.matchActionsToText(get().actionEdges.map((edge) => edge.data!), text);
            set((state) => ({ textState: textState, text: text, textActionMatches: textActionMatches, isStale: true }));

            if (addHistoryNode) useHistoryModelStore.getState().addHistoryNode(get());
        } else {
            // Only update the state because this one might still be different even if invisibly so
            set((state) => ({ textState: textState }));
        }
        
        if (updateEditor) {
            globalEditor.children = textState
            globalEditor.onChange();
        }
    },
    /**
     * All modifications done to the text in the next 200ms (arbitrary) will be marked as suggestions
     */
    suggestNextTextChanges: () => {
        set((state) => ({ suggestModeUntilTimestamp: Date.now() + 200 }));
    },
    acceptSuggestions: () => {
        let newState = (JSON.parse(JSON.stringify(get().textState))[0] as any)
        newState.children = newState.children.filter((node: any) => node.removed === undefined);
        newState.children = newState.children.map((node: any) => ({ text: node.text }));
        set((state) => ({ textState: [newState]}));
        globalEditor.children = [newState]
        globalEditor.onChange();
    },
    rejectSuggestions: () => {
        let newState = (JSON.parse(JSON.stringify(get().textState))[0] as any)
        newState.children = newState.children.filter((node: any) => node.added === undefined);
        newState.children = newState.children.map((node: any) => ({ text: node.text }));
        set((state) => ({ textState: [newState]}));
        globalEditor.children = [newState]
        globalEditor.onChange();
    },
    isTextSuggested: () => {
        return (get().textState[0] as any).children.some((node: any) => node.removed !== undefined || node.added !== undefined);
    },
    getText: () => {
        return get().textState.map((node: any) => SlateNode.string({ children: node.children.filter((c: any) => c.removed === undefined) })).join("\n");
    },
    setSelectedNodes: (nodes) => {
        if (!shallow(get().selectedNodes, nodes)) {
            set((state) => ({ selectedNodes: nodes }));
        }
    },
    setSelectedEdges: (edges) => {
        if (!shallow(get().selectedEdges, edges)) {
            // Make sure the right edge is selected in the list of edges
            const allEdges = get().actionEdges;
            let modified = false;
            for (const edge of allEdges) {
                edge.selected = false;
                if (edges.includes(edge.id) && !edge.selected) {
                    modified = true;
                    edge.selected = true;
                }
            }
            if (modified) set((state) => ({ actionEdges: allEdges }));
            useStudyStore.getState().logEvent("EDGES_SELECTED", { edges });
            set((state) => ({ selectedEdges: edges }));
        }
    },
    setHighlightedActionsSegment: (startActionId, endActionId) => {
        if (get().highlightedActionsSegment?.start !== startActionId || get().highlightedActionsSegment?.end !== endActionId) {
            set((state) => ({ highlightedActionsSegment: startActionId !== null && endActionId !== null ? { start: startActionId, end: endActionId } : null }));
        }
    },
    setFilteredActionsSegment: (startActionId, endActionId) => {
         // Only modify if different (zustand is not clever enough to do this by itself)
         if (get().filteredActionsSegment?.start !== startActionId || get().filteredActionsSegment?.end !== endActionId) {
            set((state) => ({ filteredActionsSegment: startActionId !== null && endActionId !== null ? { start: startActionId, end: endActionId } : null }));
         }
    },
    setHighlightedEntities: (entities) => {
        set((state) => ({ highlightedEntities: entities }));
    },
    setIsStale: (isStale) => {
        set((state) => ({ isStale: isStale }));
    },
    setAPIKey: (key) => {
        apiManager.setApiKey(key);
    },
    setAPIType: (apiType) => {
        apiManager.setAPIType(apiType);
        set((state) => ({ apiType: apiType }));
        // 如果有初始API密钥，也要重新设置以使用新的配置
        if (apiKey) {
            apiManager.setApiKey(apiKey);
        }
    },
    getDefaultApiType: () => {
        return defaultApiType;
    },
    setIsReadOnly: (isReadOnly) => {
        set((state) => ({ isReadOnly: isReadOnly }));
    }
}))

