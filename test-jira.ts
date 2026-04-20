import { create } from 'node:domain';
import { JiraService } from './src/services/jira.service';
import 'dotenv/config';

const jira = new JiraService();

async function test() {
    try {
        const myProjectKey = 'AJ';
        const jql = `project = '${myProjectKey}' ORDER BY created DESC`;
        const issues = await jira.searchIssues(jql);
        if (issues.length > 0) {
            console.log("First issue found:", issues[0].key);
        }
    } catch (err: any) {
        console.error("Connection failed!", err.message);
    }
}
async function testCreateIssue() {
    try {
        const projects = await jira.listProjects();
        console.log("Available projects:", projects);
    } catch (error: any) {
        console.error("Failed to create issue:", error.message);
    }
}

test().catch(console.error);

async function createProject() {
    try {
        const body = JSON.stringify({
            "key": "MIN",
            "name": "Minimal Project",
            "projectTypeKey": "business",
            "leadAccountId": "5cc4213f49f31c0ff41138d9",
        });
        const projects = await jira.createProject(body);
        console.log("Project created:", projects);
    } catch (error: any) {
        console.error("Failed to create project:", error.message);
    }
}

async function createIssue() {
    try {
        const descriptionADF = {
            type: 'doc',
            version: 1,
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: "descriptionText",
                        },
                    ],
                },
            ],
        };
        const payload = {
            fields: {
                project: {
                    key: 'MIN',
                },
                summary: "summary",
                description: descriptionADF,
                issuetype: {
                    name: "Task",
                },
            },
        };
        const issue = await jira.createIssue(payload);
        console.log("Issue created:", issue.key);

    } catch (error: any) {
        console.error("Failed to create issue:", error.message);
    }
}

createIssue()