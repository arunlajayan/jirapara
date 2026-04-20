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

/**
 * 1. Define the Tool List
 * We add the new methods from your service here.
 */
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
        description: "Get detailed information about at single Jira issue.",
        inputSchema: {
          type: "object",
          properties: { issueKey: { type: "string" } },
          required: ["issueKey"],
        },
      },
      {
        name: "list_projects",
        description: "List all available Jira projects.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "create_issue",
        description: "Create a new Jira issue (uses default hardcoded values).",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "create_project",
        description: "Create a new Jira project. Requires a project body object.",
        inputSchema: {
          type: "object",
          properties: {
            projectData: { type: "object", description: "The JSON body for the project" },
          },
          required: ["projectData"],
        },
      },
    ],
  };
});

/**
 * 2. Define the Tool Logic
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_issues": {
        const jql = String(args?.jql || "");
        const issues = await jira.searchIssues(jql);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(issues, null, 2) }],
        };
      }

      case "get_issue": {
        const issueKey = String(args?.issueKey || "");
        const issue = await jira.getIssue(issueKey);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "list_projects": {
        const projects = await jira.listProjects();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(projects, null, 2) }],
        };
      }

      case "create_issue": {
        const issueData = args?.issueData || {};
        const issue = await jira.createIssue(issueData);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(issue, null, 2) }],
        };
      }

      case "create_project": {
        // args.projectData will be the object passed from the LLM
        const projectData = args?.projectData || {};
        const project = await jira.createProject(projectData);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }],
        };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [{ type: "text" as const, text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Jira MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
