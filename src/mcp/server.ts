import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { JiraService } from "../services/jira.service.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const jira = new JiraService();

const server = new Server(
  { name: "jira-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_issues",
        description: "Search for Jira issues using JQL.",
        inputSchema: {
          type: "object",
          properties: { jql: { type: "string" } },
          required: ["jql"],
        },
      },
      {
        name: "get_issue",
        description: "Get detailed information about a single Jira issue.",
        inputSchema: {
          type: "object",
          properties: { issueKey: { type: "string" } },
          required: ["issueKey"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "search_issues") {
      const jql = String(args?.jql || "");
      const issues = await jira.searchIssues(jql);
      return {
        content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
      };
    }

    if (name === "get_issue") {
      const issueKey = String(args?.issueKey || "");
      const issue = await jira.getIssue(issueKey);
      return {
        content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
      };
    }

    return { 
      content: [{ type: "text", text: `Unknown tool: ${name}` }], 
      isError: true 
    };
  } catch (error: any) {
    return { 
      content: [{ type: "text", text: `Error: ${error.message}` }], 
      isError: true 
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jira MCP Server running on stdio");
}

main();
