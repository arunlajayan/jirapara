import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class JiraService {
  private baseUrl: string;
  private auth: string;

  constructor() {
    const domain = process.env.JIRA_DOMAIN;
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_API_TOKEN;

    this.baseUrl = `https://${domain}/rest/api/3`;
    // Jira uses Basic Auth with email:api_token (base64 encoded)
    this.auth = Buffer.from(`${email}:${token}`).toString('base64');
  }

  async searchIssues(jql: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/search/jql`, {
        params: { jql },
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Accept': 'application/json',
        },
      });
      return response.data.issues;
    } catch (error: any) {
      throw new Error(`Search failed: ${error.response?.data?.errorMessages?.[0] || error.message}`);
    }
  }

  async getIssue(issueKey: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/issue/${issueKey}`, {
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Accept': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Issue retrieval failed: ${error.response?.data?.errorMessages?.[0] || error.message}`);
    }
  }

  async listProjects() {
    try {
      const response = await axios.get(`${this.baseUrl}/project`, {
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Accept': 'application/json',
        },
      });
      return response.data.map((p: any) => ({ key: p.key, name: p.name }));
    } catch (error: any) {
      throw new Error(`Project retrieval failed: ${error.response?.data?.errorMessages?.[0] || error.message}`);
    }
  }

  async createProject(body: any) {
    try {
      const response = await axios.post(`${this.baseUrl}/project`, body, {
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Project creation failed: ${error.response?.data?.errorMessages?.[0] || error.message}`);
    }
  }

  async createIssue() {
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
      const response = await axios.post(`${this.baseUrl}/issue`, payload, {
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Issue creation failed: ${error.response?.data?.errorMessages?.[0] || error.message}`);
    }
  }

}
