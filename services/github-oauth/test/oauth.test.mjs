import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { handle } from "../src/index.mjs";

const env = {
  GITHUB_CLIENT_ID: "test-client",
  GITHUB_CLIENT_SECRET: "test-secret",
  SITE_ORIGIN: "https://aik64.github.io",
  ALLOWED_GITHUB_USER: "AIK64",
  GITHUB_REPO: "AIK64/aik64.github.io",
};
const worker = "https://oauth.example.workers.dev";
const neverFetch = () => { throw new Error("Unexpected network call"); };

async function begin() {
  const response = await handle(new Request(`${worker}/auth?provider=github&site_id=aik64.github.io&scope=repo`), env, neverFetch);
  assert.equal(response.status, 302);
  const target = new URL(response.headers.get("Location"));
  const cookieHeader = response.headers.get("Set-Cookie");
  return { response, target, cookie: cookieHeader.split(";")[0], cookieHeader };
}

function callback(state, cookie, suffix = "code=test-code", configuration = env, fetcher = neverFetch) {
  return handle(new Request(`${worker}/callback?state=${state}&${suffix}`, { headers: { Cookie: cookie } }), configuration, fetcher);
}

test("authorization uses fixed public_repo scope, PKCE and secure expiring cookie", async () => {
  const { target, cookie, cookieHeader } = await begin();
  assert.equal(target.origin, "https://github.com");
  assert.equal(target.searchParams.get("redirect_uri"), `${worker}/callback`);
  assert.equal(target.searchParams.get("scope"), "public_repo");
  assert.equal(target.searchParams.get("code_challenge_method"), "S256");
  const verifier = cookie.split("=")[1].split(".")[1];
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  assert.equal(target.searchParams.get("code_challenge"), Buffer.from(digest).toString("base64url"));
  for (const attribute of ["HttpOnly", "Secure", "SameSite=Lax", "Max-Age=600", "Path=/"]) assert.ok(cookieHeader.includes(attribute));
});

test("rejects foreign sites, providers, methods and missing configuration", async () => {
  for (const [path, status] of [["/auth?provider=github&site_id=evil.example", 403], ["/auth?provider=gitlab&site_id=aik64.github.io", 400], ["/unknown", 404]]) {
    assert.equal((await handle(new Request(worker + path), env, neverFetch)).status, status);
  }
  assert.equal((await handle(new Request(worker + "/auth", { method: "POST" }), env)).status, 405);
  assert.equal((await handle(new Request(worker + "/auth"), { ...env, GITHUB_CLIENT_SECRET: "" })).status, 503);
  assert.equal((await handle(new Request(worker + "/auth"), { ...env, SITE_ORIGIN: "https://example.com/path" })).status, 503);
});

test("missing cookie, mismatched state and expired session never exchange a code", async () => {
  const { target, cookie } = await begin();
  const state = target.searchParams.get("state");
  const expired = cookie.replace(/\.\d+$/, ".1");
  for (const [receivedState, receivedCookie] of [[state, ""], ["wrong-state", cookie], [state, expired]]) {
    const response = await callback(receivedState, receivedCookie);
    assert.ok((await response.text()).includes("authorization:github:error:"));
    assert.ok(response.headers.get("Set-Cookie").includes("Max-Age=0"));
  }
});

test("denied consent returns a safe CMS error", async () => {
  const { target, cookie } = await begin();
  const html = await (await callback(target.searchParams.get("state"), cookie, "error=access_denied&error_description=%3Cscript%3E")).text();
  assert.ok(html.includes("authorization:github:error:"));
  assert.ok(!html.includes("error_description"));
});

async function login({ user = "aik64", push = true, failToken = false } = {}) {
  const { target, cookie } = await begin();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    if (url.endsWith("/access_token")) {
      const body = JSON.parse(options.body);
      assert.equal(body.client_secret, env.GITHUB_CLIENT_SECRET);
      assert.equal(body.redirect_uri, `${worker}/callback`);
      assert.equal(body.code_verifier, cookie.split("=")[1].split(".")[1]);
      return Response.json(failToken ? { error: "bad_verification_code" } : { access_token: "test-access-token" });
    }
    assert.equal(options.headers.Authorization, "Bearer test-access-token");
    if (url.endsWith("/user")) return Response.json({ login: user });
    return Response.json({ permissions: { push } });
  };
  return { response: await callback(target.searchParams.get("state"), cookie, "code=test-code", env, fetcher), calls };
}

test("only allowed owner with push permission receives a token", async () => {
  const { response, calls } = await login();
  const html = await response.text();
  assert.ok(html.includes("authorization:github:success:"));
  assert.ok(html.includes("test-access-token"));
  assert.ok(!html.includes("test-secret"));
  assert.equal(calls.length, 3);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(response.headers.get("Content-Security-Policy").includes("frame-ancestors 'none'"));
});

test("disallowed users, missing push permission and failed exchange do not receive tokens", async () => {
  for (const options of [{ user: "someone-else" }, { push: false }, { failToken: true }]) {
    const { response } = await login(options);
    const html = await response.text();
    assert.ok(html.includes("authorization:github:error:"));
    assert.ok(!html.includes("test-access-token"));
  }
});

test("popup sends Decap handshake and token only to the configured opener origin", async () => {
  const { response } = await login();
  const html = await response.text();
  const source = html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)[1];
  const messages = [];
  let listener;
  const opener = { postMessage: (...args) => messages.push(args) };
  vm.runInNewContext(source, {
    window: { opener, addEventListener: (_, fn) => { listener = fn; }, removeEventListener() {} },
  });
  assert.deepEqual(messages, [["authorizing:github", env.SITE_ORIGIN]]);
  listener({ origin: "https://evil.example", source: opener, data: "authorizing:github" });
  listener({ origin: env.SITE_ORIGIN, source: {}, data: "authorizing:github" });
  assert.equal(messages.length, 1);
  listener({ origin: env.SITE_ORIGIN, source: opener, data: "authorizing:github" });
  assert.equal(messages.length, 2);
  assert.equal(messages[1][1], env.SITE_ORIGIN);
  assert.deepEqual(JSON.parse(messages[1][0].split("authorization:github:success:")[1]), { token: "test-access-token", provider: "github" });
});
