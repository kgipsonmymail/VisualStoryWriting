import { LayoutUtils } from "../../LayoutUtils";
import { useModelStore } from "../../Model";
import { ParallelPrompts } from "../utils/ParallelPrompts";
import { SentenceActionsExtractor } from "./SentenceActionsExtractor";


let VisualRefresherInstance : VisualRefresher | null = null;

export class VisualRefresher {
    previousText: string;
    onUpdate: () => void;
    onRefreshDone: () => void;

    private constructor() {
        this.previousText = "";
        this.onUpdate = () => {};
        this.onRefreshDone = () => {};
    }

    public static getInstance() {
        if (!VisualRefresherInstance) {
            VisualRefresherInstance = new VisualRefresher();
        }

        return VisualRefresherInstance;
    }

    reset() {
        this.previousText = "";
    }

    clearInvalidActions(text: string) {
        const actionEdges = useModelStore.getState().actionEdges;
        const newActionEdges = actionEdges.filter((actionEdge) => text.includes(actionEdge.data!.passage));
        useModelStore.getState().setActionEdges(newActionEdges);
    }

    clearInvalidEntities(text: string) {
        const entityNodes = useModelStore.getState().entityNodes;
        const newEntityNodes = entityNodes.filter((entityNode) => text.toLowerCase().includes(entityNode.data.name.toLowerCase()));
        useModelStore.getState().setEntityNodes(newEntityNodes);
    }

    clearInvalidLocations() {
        // We consider a location as invalid if it is not mentioned in any of the actions
        const locationNodes = useModelStore.getState().locationNodes;
        const actionEdges = useModelStore.getState().actionEdges;
        const locationsInActions = [...new Set(actionEdges.map((actionEdge) => actionEdge.data!.sourceLocation).concat(actionEdges.map((actionEdge) => actionEdge.data!.targetLocation)))];
        const newLocationNodes = locationNodes.filter((locationNode) => locationsInActions.includes(locationNode.data.name));
        useModelStore.getState().setLocationNodes(newLocationNodes);
    }

    refreshFromText(text: string, onUpdate?: () => void, onFinished?: () => void) {
        console.log("VisualRefresher.refreshFromText called with text length:", text.length);
        if (this.previousText === text) {
            console.log("Text unchanged, skipping refresh");
            return;
        }

        // First we clear everything that became invalid since the new text
        console.log("Stopping all simulations and clearing selections");
        LayoutUtils.stopAllSimulations();
        // We will be playing with the actions, the selection will become meaningless, better to clear it
        //TODO: Be smart and only unselect the things that are actually becoming invalid. Otherwise try very hard to preserve the selection
        useModelStore.getState().setSelectedNodes([]);
        useModelStore.getState().setSelectedEdges([]);
        useModelStore.getState().setFilteredActionsSegment(null, null);
        useModelStore.getState().setHighlightedActionsSegment(null, null);

        this.clearInvalidActions(text);
        
        // Loop over the sentences in the text by finding the index position of the periods
        // Support both English and Chinese punctuation marks
        const regex = /[^.!?。！？]+[.!?。！？]+/g;
        let result;
        let sentences : {start: number, end: number, text: string}[] = [];

        while ( (result = regex.exec(text)) ) {
            const startIdx = result.index;
            const endIdx = result.index + result[0].length;
            const sentenceStr = result[0].replace(/^\s+|\s+$/g, '');

            if (sentenceStr.length < 20 && sentences.length > 0) { // Arbitrary threshold just to detect very short sentences
                sentences[sentences.length - 1].end = endIdx;
                sentences[sentences.length - 1].text = text.substring(sentences[sentences.length - 1].start, endIdx).replace(/^\s+|\s+$/g, '');
            } else {
                sentences.push({start: startIdx, end: endIdx, text: sentenceStr});
            }
        }

        // Fallback: if no sentences found (e.g., text without punctuation), treat entire text as one sentence
        if (sentences.length === 0 && text.trim().length > 0) {
            console.log("No sentences found with punctuation, treating entire text as one sentence");
            sentences.push({
                start: 0,
                end: text.length,
                text: text.trim()
            });
        }

        // Only bother updating the sentences that were not already in the previous text
        sentences = sentences.filter((sentence) => !this.previousText.includes(sentence.text));
        
        // Now we extract the actions from each sentences
        const actionPromises = sentences.map((sentence) => {
            const entities = useModelStore.getState().entityNodes;
            const sentenceExtractor = new SentenceActionsExtractor(entities, text.substring(0, sentence.start), sentence.text, text.substring(sentence.end, text.length));
            sentenceExtractor.onUpdate = () => {
                if (onUpdate) onUpdate();
                this.onUpdate();
            }
            return sentenceExtractor;
        });

        console.log(`Found ${sentences.length} sentences to process`);
        new ParallelPrompts(actionPromises).execute().then((results) => {
            console.log("ParallelPrompts execution completed with results:", results);
            const actions = useModelStore.getState().actionEdges.map((actionEdge) => {
                const sourceEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionEdge.source);
                const targetEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionEdge.target);
                return {name: actionEdge.data?.name, source: sourceEntity?.data.name, target: targetEntity?.data.name, location: actionEdge.data?.sourceLocation, passage: actionEdge.data?.passage}
            });
            console.log("Extracted actions:", actions);

            if (onFinished) {
                console.log("Calling onFinished callback");
                onFinished();
            }
            console.log("Calling onRefreshDone");
            this.onRefreshDone();
        }).catch((error) => {
            console.error("Error in ParallelPrompts execution:", error);
        });


        this.previousText = text;
    }
}