/**
 * Auto-generated API request code snippets for the API Playground.
 * Supports cURL, JavaScript/TypeScript, Python, and Go.
 */

export interface SnippetParams {
  endpoint: string;      // e.g. '/api/playground/benchmark'
  method: string;        // 'POST' | 'GET'
  body: Record<string, unknown> | null;
  baseUrl: string;       // e.g. 'https://api.compressionai.dev'
  authTokenPreview: string; // first 20 chars of the user's token
}

function jsonPretty(body: Record<string, unknown> | null, indent = 2): string {
  if (!body) return '';
  return JSON.stringify(body, null, indent);
}

export function generateCurl(p: SnippetParams): string {
  const lines: string[] = [
    `curl -X ${p.method} '${p.baseUrl}${p.endpoint}' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'Authorization: Bearer ${p.authTokenPreview}...' \\`,
  ];
  if (p.body) {
    const escaped = jsonPretty(p.body).replace(/'/g, "'\\''");
    lines.push(`  -d '${escaped}'`);
  }
  return lines.join('\n');
}

export function generateJs(p: SnippetParams): string {
  const body = jsonPretty(p.body);
  return `// Node.js / Browser (fetch)
const response = await fetch('${p.baseUrl}${p.endpoint}', {
  method: '${p.method}',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.COMPRESSIONAI_TOKEN,
  },${p.body ? `
  body: JSON.stringify(${body}),` : ''}
});

if (!response.ok) {
  throw new Error(\`API error: \${response.status}\`);
}

const data = await response.json();
console.log(data);`;
}

export function generateTypeScript(p: SnippetParams): string {
  const body = jsonPretty(p.body);
  return `// TypeScript SDK-style client
import axios from 'axios';

interface BenchmarkResponse {
  provider: string;
  model: string;
  original: { inputTokens: number; outputTokens: number; latencyMs: number; cost: number; response: string };
  compressed: { inputTokens: number; outputTokens: number; latencyMs: number; cost: number; response: string };
  telemetry: {
    tokensSaved: number;
    costSaved: number;
    fidelity: { score: number; verdict: string };
  };
}

const client = axios.create({
  baseURL: '${p.baseUrl}',
  headers: {
    Authorization: \`Bearer \${process.env.COMPRESSIONAI_TOKEN}\`,
  },
});

const { data } = await client.request<{ data: BenchmarkResponse }>({
  method: '${p.method}',
  url: '${p.endpoint}',${p.body ? `
  data: ${body},` : ''}
});

console.log(data.data);`;
}

export function generatePython(p: SnippetParams): string {
  const body = p.body ? JSON.stringify(p.body, null, 4) : null;
  return `# Python 3.x with requests
import os
import requests

url = '${p.baseUrl}${p.endpoint}'
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {os.environ["COMPRESSIONAI_TOKEN"]}',
}
${body ? `payload = ${body.replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None')}

response = requests.${p.method.toLowerCase()}(url, headers=headers, json=payload)` : `
response = requests.${p.method.toLowerCase()}(url, headers=headers)`}
response.raise_for_status()
data = response.json()
print(data)`;
}

export function generateGo(p: SnippetParams): string {
  const bodyLines = p.body
    ? Object.entries(p.body)
        .map(([k, v]) => `\t\t"${k}": ${JSON.stringify(v)},`)
        .join('\n')
    : '';

  return `package main

import (
\t"bytes"
\t"encoding/json"
\t"fmt"
\t"io"
\t"net/http"
\t"os"
)

func main() {
\turl := "${p.baseUrl}${p.endpoint}"
${p.body ? `\tpayload := map[string]interface{}{
${bodyLines}
\t}
\tbody, _ := json.Marshal(payload)

\treq, err := http.NewRequest("${p.method}", url, bytes.NewBuffer(body))` : `\treq, err := http.NewRequest("${p.method}", url, nil)`}
\tif err != nil {
\t\tfmt.Println("error:", err)
\t\treturn
\t}

\treq.Header.Set("Content-Type", "application/json")
\treq.Header.Set("Authorization", "Bearer "+os.Getenv("COMPRESSIONAI_TOKEN"))

\tclient := &http.Client{}
\tresp, err := client.Do(req)
\tif err != nil {
\t\tfmt.Println("request failed:", err)
\t\treturn
\t}
\tdefer resp.Body.Close()

\tdata, _ := io.ReadAll(resp.Body)
\tfmt.Println(string(data))
}`;
}

export interface Snippet {
  language: 'bash' | 'javascript' | 'typescript' | 'python' | 'go';
  label: string;
  filename: string;
  code: string;
}

export function generateAllSnippets(p: SnippetParams): Snippet[] {
  return [
    { language: 'bash', label: 'cURL', filename: 'request.sh', code: generateCurl(p) },
    { language: 'javascript', label: 'JavaScript', filename: 'request.js', code: generateJs(p) },
    { language: 'typescript', label: 'TypeScript SDK', filename: 'client.ts', code: generateTypeScript(p) },
    { language: 'python', label: 'Python', filename: 'request.py', code: generatePython(p) },
    { language: 'go', label: 'Go', filename: 'main.go', code: generateGo(p) },
  ];
}
