# 修改前的 Decap 后台备份

`admin/` 是调整 PaperMod 样式之前的完整后台副本，保留当时已配置的 Worker 地址。
不包含 OAuth Secret。备份位于 Hugo 的 static/content 目录之外，不会作为网页发布。

在仓库根目录运行即可恢复原版（覆盖当前后台入口和配置）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\backups\admin-before-papermod-20261026\restore.ps1
```

新增的样式和脚本会成为未引用文件，不影响原版功能。恢复后提交并部署，线上才会恢复。
如果后来调整过 `static/admin/config.yml` 的 OAuth 配置，恢复前保留这些新配置，恢复后再应用。

备份 SHA256：

- index.html: `DCF58F3F5D50C1155CC07DCAA01FCAEE56BACF9567CD4F439D995E713C3C8D83`
- config.yml: `EBCA453D9F73B152963E1546DC9EDE9A116E8AEC785645ADFCF67D263A394752`
