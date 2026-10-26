const COOKIE = "__Host-blog-oauth";
const TTL = 600;
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
const cookie = value => `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value ? TTL : 0}`;

function response(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  } });
}

function popup(origin, result, success) {
  const nonce = random();
  const message = `authorization:github:${success ? "success" : "error"}:${JSON.stringify(result)}`;
  const literal = value => JSON.stringify(value).replace(/</g, "\\u003c");
  return response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>GitHub 登录</title>
<p id="status">正在完成登录，请保持此窗口打开。</p>
<script nonce="${nonce}">
const origin = ${literal(origin)};
const message = ${literal(message)};
if (!window.opener) {
  document.getElementById('status').textContent = '请关闭此窗口，从博客 /admin/ 页面重新登录。';
} else {
  window.addEventListener('message', function receive(event) {
    if (event.origin !== origin || event.source !== window.opener || event.data !== 'authorizing:github') return;
    window.removeEventListener('message', receive);
    window.opener.postMessage(message, origin);
  });
  window.opener.postMessage('authorizing:github', origin);
}
</script></html>`, 200, {
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": cookie(""),
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  });
}

export async function handle(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (request.method !== "GET") return response("Method not allowed", 405, { Allow: "GET" });
  if (!["/auth", "/callback"].includes(url.pathname)) return response("Not found", 404);
  if (!env.GITHUB_CLIENT_ID || env.GITHUB_CLIENT_ID.startsWith("REPLACE_") || !env.GITHUB_CLIENT_SECRET ||
      !env.ALLOWED_GITHUB_USER || !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPO || "")) {
    return response("请先配置 Worker 的 GitHub OAuth 参数与 Secret。", 503);
  }
  let origin;
  try {
    const site = new URL(env.SITE_ORIGIN);
    if (site.protocol !== "https:" || site.origin !== env.SITE_ORIGIN) throw new Error();
    origin = site.origin;
  } catch {
    return response("SITE_ORIGIN 必须是 HTTPS origin，不能包含路径或末尾斜杠。", 503);
  }
  const redirectUri = `${url.origin}/callback`;
  if (url.pathname === "/auth") {
    if (url.searchParams.get("provider") !== "github") return response("Unsupported provider", 400);
    const siteId = url.searchParams.get("site_id");
    if (siteId !== new URL(origin).hostname) return response("Site not allowed", 403);
    const state = random();
    const verifier = random();
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const target = new URL("https://github.com/login/oauth/authorize");
    target.search = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID, redirect_uri: redirectUri, scope: "public_repo", state,
      code_challenge: challenge, code_challenge_method: "S256",
    }).toString();
    return response("", 302, {
      Location: target.href,
      "Set-Cookie": cookie(`${state}.${verifier}.${Date.now()}`),
    });
  }

  const session = (request.headers.get("Cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  const [state, verifier, issued] = (session || "").split(".");
  const age = Date.now() - Number(issued);
  if (!/^[a-f0-9]{64}$/.test(state || "") || !/^[a-f0-9]{64}$/.test(verifier || "") ||
      !Number.isFinite(age) || age < 0 || age > TTL * 1000 || state !== url.searchParams.get("state")) {
    return popup(origin, { message: "登录验证失败或已过期，请重新登录。" }, false);
  }
  if (url.searchParams.has("error") || !url.searchParams.get("code")) {
    return popup(origin, { message: "GitHub 授权未完成，请重新登录。" }, false);
  }
  try {
    const tokenResponse = await fetcher("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
        code: url.searchParams.get("code"), redirect_uri: redirectUri, code_verifier: verifier }),
    });
    if (!tokenResponse.ok) throw new Error();
    const token = await tokenResponse.json();
    if (!token.access_token || token.error) throw new Error();
    const headers = { Authorization: `Bearer ${token.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "AIK64-Blog-OAuth" };
    const userResponse = await fetcher("https://api.github.com/user", { headers });
    if (!userResponse.ok) throw new Error();
    const user = await userResponse.json();
    if (typeof user.login !== "string" || user.login.toLowerCase() !== env.ALLOWED_GITHUB_USER.toLowerCase()) {
      return popup(origin, { message: "此后台仅允许博客所有者登录。" }, false);
    }
    const repoResponse = await fetcher(`https://api.github.com/repos/${env.GITHUB_REPO}`, { headers });
    if (!repoResponse.ok || !(await repoResponse.json()).permissions?.push) {
      return popup(origin, { message: "当前账号没有博客仓库的写入权限。" }, false);
    }
    return popup(origin, { token: token.access_token, provider: "github" }, true);
  } catch {
    return popup(origin, { message: "GitHub 登录失败，请重试并检查 OAuth App 和 Worker 配置。" }, false);
  }
}

export default { fetch: (request, env) => handle(request, env) };
