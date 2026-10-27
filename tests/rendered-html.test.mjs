import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      DB: null,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the landing page", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /알고리즘 워밍업/);
  assert.match(html, /href="\/write"/);
  assert.doesNotMatch(html, /href="\/execute"/);
  assert.match(html, /href="\/teacher"/);
});

test("server-renders the write page", async () => {
  const response = await render("/write");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /워밍업/);
});

test("server-renders the write algorithm page", async () => {
  const response = await render("/write/algorithm");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /워밍업/);
});

test("server-renders the write explore page", async () => {
  const response = await render("/write/explore");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /워밍업/);
});

test("server-renders the execute page", async () => {
  const response = await render("/execute");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /체험/);
});

test("server-renders the teacher page", async () => {
  const response = await render("/teacher");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /교사용/);
});

test("server-renders the teacher student-preview page", async () => {
  const response = await render("/teacher/student-preview");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /학생 입장에서 체험하기/);
  assert.match(html, /카드 뒤집기/);
  assert.match(html, /택배 트럭/);
  assert.match(html, /사탕 나누기/);
});

for (const problem of ["woodcut", "constellation", "maxbox"]) {
  test(`standalone ${problem} preview redirects to administrator login`, async () => {
    const response = await render(`/dev-preview-${problem}`);
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/teacher");
  });
}
