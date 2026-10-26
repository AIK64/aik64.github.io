# 网页写博客：Decap CMS + GitHub OAuth + Cloudflare Workers

## 已准备的代码

- `/admin/`：Decap CMS 写作后台，导航栏新增“写作”。
- `static/admin/config.yml`：直接管理 `master` 分支的 `content/posts/*.md`。
- 图片上传到 `static/images/uploads/`，文章使用 `/images/uploads/…` 引用。
- `services/github-oauth/`：无数据库、无第三方运行时依赖的 OAuth Worker。
- 只有 `AIK64` 账号且拥有博客仓库写权限时，Worker 才会向后台返回 Token。

文章保存为 GitHub 提交，现有 `.github/workflows/hugo.yml` 自动构建部署。
本地代码准备完成不等于线上已启用；下面的 OAuth App、Worker 和站点部署都完成后才能登录。

## 1. 首次部署 Worker，取得地址

在 PowerShell 中执行（需要 Node.js，首次运行 npx 会安装 Wrangler）：

```powershell
cd D:\Code\Self-use\aik64.github.io\services\github-oauth
npx wrangler@4 login
npx wrangler@4 deploy
```

浏览器登录 Cloudflare 并授权后，部署会输出类似地址：

```text
https://aik64-blog-oauth.<你的 Cloudflare 子域名>.workers.dev
```

先记下实际地址。首次部署还未配置认证参数，访问认证接口会返回配置提示，这是预期行为。
无需 KV、D1 或 R2。请勿开启记录请求/响应正文的调试功能来排查 OAuth，以免暴露凭据。

## 2. 创建 GitHub OAuth App

打开 https://github.com/settings/developers → OAuth Apps → New OAuth App。

填写：

| 设置 | 值 |
| --- | --- |
| Application name | AIK64 Blog Editor |
| Homepage URL | `https://aik64.github.io` |
| Authorization callback URL | `https://实际 Worker 域名/callback` |

回调地址应精确匹配，不启用回调通配符。创建后复制 **Client ID**，并生成 **Client Secret**。
Client Secret 只填到 Cloudflare Secret 中，不要放进仓库、CMS 配置或聊天消息。

## 3. 配置 Worker

修改 `services/github-oauth/wrangler.toml` 中的 `GITHUB_CLIENT_ID`，替换为真实 Client ID。
Client ID 是公开标识，可以提交。其余配置已按当前博客填写：

```toml
SITE_ORIGIN = "https://aik64.github.io"
ALLOWED_GITHUB_USER = "AIK64"
GITHUB_REPO = "AIK64/aik64.github.io"
```

在 Worker 目录执行：

```powershell
npx wrangler@4 secret put GITHUB_CLIENT_SECRET
```

根据终端提示粘贴 Secret，然后重新部署最新配置：

```powershell
npx wrangler@4 deploy
```

Worker 使用 `public_repo` OAuth scope。它允许授权账号读写有权限的公开仓库，**不是仅限这个博客仓库的 Token**；OAuth App 不支持 fine-grained PAT 那样的单仓库权限设置。
Worker 自己只检查配置的仓库，不提供通用 API 代理。Decap 获取 Token 后直接调用 GitHub API。
如果以后把内容仓库改成私有，需要重新评估授权范围，并同时修改 CMS 和 Worker 的 scope。

## 4. 关联写作后台

修改 `static/admin/config.yml`：

```yaml
backend:
  name: github
  repo: AIK64/aik64.github.io
  branch: master
  base_url: https://实际 Worker 域名
  auth_endpoint: auth
  auth_scope: public_repo
```

`base_url` 只填 Worker 的 HTTPS origin，不带路径、末尾斜杠或 `/auth`。
提交并推送本次修改到 `master`，等待 GitHub Actions 成功完成部署。
仅修改本地文件不会更新线上后台。

## 5. 登录与发布

1. 打开 `https://aik64.github.io/admin/`，点击 GitHub 登录，允许弹窗。
2. 用 `AIK64` 账号授权应用。回调完成后弹窗应自动关闭并进入文章列表。
3. 新建文章，填写标题、时间、标签、分类、摘要和正文，可在编辑器中上传图片。
4. 保持“草稿”开启并保存：文件写入仓库，但 Hugo 不展示此文章。
5. 准备公开时关闭“草稿”，保存/发布，等待 Actions 完成，再打开博客检查文章和图片。

注意：

- 仓库公开，因此草稿 Markdown 和上传的图片也公开；草稿不适合保存私密内容。
- 未来的发布时间不会立即显示，因为站点配置为 `buildFuture: false`；到时间后还需要重新构建，不含定时发布能力。
- 编辑器预览用于检查正文，不等于 PaperMod 的完整页面效果。
- CMS 使用 GitHub API 将修改提交到 `master`，保存不是纯本地操作。
- Decap 会在浏览器保存登录凭据；请只在可信设备上使用，共享设备使用后退出登录。
- 当前后台使用 Decap 的 `@3` CDN 版本通道，需要能够访问 unpkg.com；后续可固定经过验证的具体版本或自行托管构建文件。

## 验证与排错

运行 Worker 自动测试（不访问真实 GitHub、不需要 Secret）：

```powershell
cd D:\Code\Self-use\aik64.github.io\services\github-oauth
node --test
```

上线验收：先保存一篇草稿，确认仓库新增 Markdown 且博客不展示；再关闭草稿发布，确认 Actions 成功、文章和图片可访问。

| 现象 | 检查 |
| --- | --- |
| 后台无法加载 | GitHub Pages 是否已部署 `static/admin/`，浏览器能否加载 unpkg.com |
| OAuth 配置提示 | Client ID 是否替换，`GITHUB_CLIENT_SECRET` 是否已配置并部署 |
| GitHub 回调错误 | OAuth App 的 callback URL 是否与实际 Worker `/callback` 完全一致 |
| 弹窗不关闭 | CMS 的 `base_url`、Worker 的 `SITE_ORIGIN` 是否精确匹配当前域名，是否允许弹窗 |
| 验证失败或过期 | 从 `/admin/` 重新发起登录；不要复制回调链接或同时打开多个登录弹窗 |
| 无权登录 | 当前 GitHub 账号是否为 `AIK64`，是否对内容仓库有 push 权限 |
| 保存成功但未显示 | 草稿、未来日期、Actions 状态、浏览器缓存 |

撤销授权：GitHub Settings → Applications → Authorized OAuth Apps → 找到应用并撤销。
如果 Secret 泄露，在 GitHub OAuth App 中轮换 Secret，并更新 Cloudflare Secret。
将来使用自定义博客域名时，需要同步更新 Hugo baseURL、CMS site_url/display_url、Worker SITE_ORIGIN 和 OAuth App Homepage URL。

## 后台外观与回滚

后台采用 PaperMod 的黑白灰配色、系统字体、细边框和圆角卡片，并增加博客品牌导航和主题切换。
主题使用博客原有的 `pref-theme` 偏好，同一域名下与博客共享明暗设置。文章预览包含标题、日期、草稿标记、摘要、正文和标签。

样式与逻辑文件：

- `static/admin/papermod.css`：后台外观。
- `static/admin/theme.js`：主题偏好和切换。
- `static/admin/preview.css`、`preview.js`：正文预览。

原版完整保存在 `backups/admin-before-papermod-20261026/admin/`。在仓库根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backups\admin-before-papermod-20261026\restore.ps1
```

此脚本恢复原版入口和当时的 CMS 配置；新增样式文件不再被引用。恢复后推送部署，线上才会回滚。
这次外观调整不需要重新部署 OAuth Worker。

后台 CSS 按 Decap 组件名称覆盖样式。将来升级 Decap 时，应复查列表、编辑器、媒体弹窗和明暗主题；它不改变 Decap 本身的布局和业务功能。

验证记录：使用独立临时目录中的 `test-repo` 后端检查了列表、编辑器预览、主题切换、演示保存流程与媒体弹窗，未向真实仓库提交测试文章。正式 `static/admin/config.yml` 仍使用 GitHub 后端。

## 参考资料

- https://decapcms.org/docs/github-backend/
- https://decapcms.org/docs/configuration-options/
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- https://developers.cloudflare.com/workers/configuration/secrets/
