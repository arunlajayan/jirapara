import { spawn, ChildProcess } from "child_process";
import * as readline from "readline";

// Configuration
const LLAMA_URL = "http://localhost:8080/v1/chat/completions";
const MCP_SERVER_COMMAND = "node";
const MCP_SERVER_ARGS = ["mcp/server.js"]; // Assumes you've compiled server.ts to server.js

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

async function runAgent() {
  // t1: Start the Jira MCP Server
  const mcpProcess = spawn(MCP_SERVER_COMMAND, MCP_SERVER_ARGS, {
    shell: true,
  });

  // Helper to communicate with the MCP server via stdio
  const sendMcpRequest = (method: string, params: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      const jsonRpc = JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      });

      // Send to stdin
      mcpProcess.stdin.write(jsonRpc + "\n");

      // Listen for one response
      const listener = (data: any) => {
        const str = data.toString();
        // Simple parser to find the first complete JSON object in the stream
        try {
          const json = JSON.parse(str);
          mcpProcess.stdout.removeListener("data", listener);
          resolve(json);
        } catch (e) {
          // If it's a partial chunk, keep waiting
        }
      };
      mcpProcess.stdout.on("data", listener);
    });
  };

  // We need to extract the tool schemas from the server to give to Llama
  // For simplicity, we define the tool schemas here to match your server.ts
  const tools = [
    {
      type: "function",
      function: {
        name: "search_issues",
        description: "Search for Jira issues using JQL.",
        parameters: {
          type: "object",
          properties: { jql: { type: "string" } },
          required: ["jql"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_issue",
        description: "Get detailed information about a single Jira issue.",
        parameters: {
          type: "object",
          properties: { issueKey: { type: "string" } },
          required: ["issueKey"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_projects",
        description: "List all available Jira projects.",
        parameters: { type: "object", properties: {} },
      },
    },
  ];

  const chatHistory: Message[] = [
    {
      role: "system",
      content: "You are a helpful assistant with access to Jira. Use tools to answer questions.",
    },
  ];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("--- Jira AI Agent Started ---");
  console.log("Type your question below (or 'exit' to quit).");

  const ask = async (userInput: string): Promise<void> => {
    chatHistory.push({ role: "user", content: userInput });

    let isProcessing = true;
    while (isProcessing) {
      // 1. Send current history to Llama
      const response = await fetch(LLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama", // your model name
          messages: chatHistory,
          tools: tools,
          tool_choice: "auto",
        }),
      });

      const resJson = await response.json();
      const assistantMsg = resJson.choices[0].message;
      chatHistory.push(assistantMsg);

      // Case A: The LLM wants to call a tool
      if (assistantMsg.tool_calls) {
        for (const toolCall of assistantMsg.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);

          console.log(`\n[Agent] Calling tool: ${name} with args:`, args);

          // 2. Execute the tool via MCP (using the JSON-RPC call)
          // Note: In a real production app, you'd map 'name' to 'tools/call'
          const mcpResponse = await sendMcpRequest("tools/call", {
            name: name,
            arguments: args,
          });

          // 3. Add the tool result to the history
          chatHistory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(mcpResponse.result?.content[0]?.text || mcpResponse.result),
          });
        }
        // Loop continues to let LLM process the tool results
      } else {
        // Case B: The LLM gave a final answer
        console.log(`\n[Assistant]: ${assistantMsg.content}`);
        isProcessing = false;
      }
    }
  };

  // Prompt loop
  const inputLoop = () => {
    rl.question("\n> ", async (input) => {
      if (input.toLowerCase() === "exit") {
        mcpProcess.kill();
        process.exit();
      }
      await ask(input);
      inputLoop();
    });
  };

  inputLoop();
}

runAgent().catch(console.error);
