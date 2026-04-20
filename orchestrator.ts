import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport }  from "@modelcontextprotocol/sdk/client/stdio.js";
import axios from "axios";
import { env } from "process";

// This helper tells the orchestrator where to find the server
const isDev = process.env.NODE_ENV !== 'production';

// If DEV: we point to the .ts file
// If PROD: we point to the .js file in the dist folder
const SERVER_PATH = isDev ? "./server/server.ts" : "./dist/server/server.js";

class Orchestrator {
  private mcpClient: Client | null = null;
  private readonly llmUrl: string;
  private readonly serverPath: string;

  constructor(llmUrl: string, serverPath: string) {
    this.llmUrl = llmUrl;
    this.serverPath = serverPath;
  }

  async initMcp(): Promise<void> {
    const transport = new StdioClientTransport({
      command: "node", // or "npx" if running dev
      args: [this.serverPath],
      // For dev mode, we use ts-node to run the .ts files
      // For prod mode, we run the built .js files
      env: {
        ...process.env,
        JIRA_DOMAIN: process.env.JIRA_DOMAIN || "",
        JIRA_EMAIL: process.env.JIRA_EMAIL || "",
        JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || "",
      },
    });

    this.mcpClient = new Client(
      { name: "orchestrator-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await this.mcpClient.connect(transport);
    console.log(`✅ Connected to Jira via ${this.serverPath}`);
  }

  async chat(userMessage: string): Promise<string> {
    if (!this.mcpClient) throw new Error("MCP Client not initialized.");

    // Step s1: LLM decides the tool
    const llmRes = await axios.post<any>(this.llmUrl, {
      prompt: `You are a Jira assistant. Use tools to answer.
      Available tools: search_issues, get_issue, list_projects.
      If you need a tool, output ONLY JSON: {"tool": "name", "args": {}}
      
      User: ${userMessage}\nAssistant:`,
      n_predict: 100,
      stop: ["\n"]
    });

    const content = llmRes.data.content.trim();

    // If the LLM output is a tool call
    if (content.includes("{")) {
      try {
        const { tool, args } = JSON.parse(content);
        const toolResult = await this.mcpClient.callTool({ name: tool, arguments: args });
        // const toolText = toolResult.content[0].text;

        // Final Pass: Get a natural language answer from the tool results
        const finalRes = await axios.post<any>(this.llmUrl, {
          prompt: `Context: ${toolResult}\nUser: ${userMessage}\nAssistant:`,
          n_predict: 150,
          stop: ["\n"]
        });
        return finalRes.data.content.trim();
      } catch (e) {
        return content;
      }
    }
    return content;
  }
}

// ... rest of your express code ...
const ORCHESTRATOR = new Orchestrator("http://localhost:8080/completion", SERVER_PATH);
