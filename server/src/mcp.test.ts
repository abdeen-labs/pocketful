import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Config } from "./config";
import { initDb } from "./db";
import { createApp } from "./index";

// The MCP endpoint rides the same Express stack as /api, so these run over
// real HTTP with the SDK's own client: auth has to fail before the transport
// ever sees a request, and every tool has to reach the shared pass service.
// Signing needs real certificates, so create_pass asserts the 422 from the
// signing step — proof that the body parser, validation, and the bundled
// icon fallback all ran first.

const API_TOKEN = "test-api-token";

function testConfig(dataDir: string): Config {
  return {
    port: 0,
    passTypeIdentifier: "pass.test.pocketful",
    teamIdentifier: "TESTTEAM01",
    organizationName: "Pocketful Tests",
    apiToken: API_TOKEN,
    passTtlSeconds: 900,
    passStoreMaxBytes: 128 * 1024 * 1024,
    dataDir,
    certs: {
      wwdr: Buffer.from("dummy"),
      signerCert: Buffer.from("dummy"),
      signerKey: Buffer.from("dummy"),
    },
  };
}

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

let server: Server;
let base: string;

before(async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "pocketful-mcp-"));
  initDb(dataDir);
  server = createApp(testConfig(dataDir)).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

async function connect(token: string): Promise<Client> {
  const client = new Client({ name: "pocketful-tests", version: "0.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${token}` } },
    })
  );
  return client;
}

async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "pocketful-tests", version: "0.0.0" },
  },
};

function rawPost(headers: Record<string, string>): Promise<Response> {
  return fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(INITIALIZE),
  });
}

test("the MCP endpoint rejects a missing token", async () => {
  const res = await rawPost({});
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: "Missing or invalid API token" });
});

test("the MCP endpoint rejects a wrong token", async () => {
  const res = await rawPost({ authorization: "Bearer not-the-token" });
  assert.equal(res.status, 401);
});

test("GET /mcp is not a session stream", async () => {
  const res = await fetch(`${base}/mcp`, {
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      accept: "text/event-stream",
    },
  });
  assert.equal(res.status, 405);
});

test("a client with the token initializes and sees the six tools", async () => {
  const client = await connect(API_TOKEN);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      [
        "create_pass",
        "delete_pass",
        "get_pass_spec",
        "list_passes",
        "mint_pass_download",
        "update_pass",
      ]
    );
    // The hosted server cannot read files on the agent's machine, so the
    // stdio-era image_files parameter must not be offered.
    const create = tools.find((tool) => tool.name === "create_pass");
    assert.ok(create);
    assert.deepEqual(Object.keys(create.inputSchema.properties ?? {}), ["spec"]);
  } finally {
    await client.close();
  }
});

test("list_passes reaches the pass store", async () => {
  const client = await connect(API_TOKEN);
  try {
    const result = await call(client, "list_passes");
    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(result.content[0].text), { passes: [] });
  } finally {
    await client.close();
  }
});

test("tool failures carry the API status and message", async () => {
  const client = await connect(API_TOKEN);
  try {
    const result = await call(client, "get_pass_spec", {
      serial_number: "missing",
    });
    assert.equal(result.isError, true);
    assert.equal(
      result.content[0].text,
      "Error 404: No updatable pass with that serial number"
    );
  } finally {
    await client.close();
  }
});

test("create_pass fills in the bundled icon and reaches the signer", async () => {
  const client = await connect(API_TOKEN);
  try {
    const result = await call(client, "create_pass", {
      spec: { style: "generic", description: "MCP test pass" },
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Error 422: Failed to build pass/);
  } finally {
    await client.close();
  }
});
