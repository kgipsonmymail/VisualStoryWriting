import { BasePrompt } from "./BasePrompt";



export class ParallelPrompts<O> extends BasePrompt<O[]> {
    prompts: BasePrompt<O>[];
    constructor(prompts: BasePrompt<O>[]) {
        super();
        this.prompts = prompts;
    }

    async runSequentiallyWithDelay() {
        console.log(`Starting parallel execution of ${this.prompts.length} prompts`);
        const results = [];
        for (let i = 0; i < this.prompts.length; i++) {
            console.log(`Executing prompt ${i + 1}/${this.prompts.length}`);
            const result = await this.prompts[i].execute();
            results.push(result);
            console.log(`Prompt ${i + 1} completed`);
            //await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }
        console.log("All prompts completed");
        return results;
    }

    execute(): Promise<O[]> {
        return this.runSequentiallyWithDelay();
        //return Promise.all(this.prompts.map(prompt => prompt.execute()));
    }
}