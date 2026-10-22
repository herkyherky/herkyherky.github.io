# ACM 集训队 · 从思考，到突破

基于《ACM集训队管理方案（新增学风建设）》制作的静态展示网站。

原生 HTML / CSS / JavaScript，无需安装依赖或构建，无第三方字体、脚本或图片请求。支持手机、平板与桌面设备。

- 分屏滚动与逐屏入场动画
- 算法线框、轨道动画、数字入场与阅读进度
- 八个主题章节、方案全文目录与原文下载
- 键盘导航、减少动态效果偏好、动态效果开关
- 所有待批准、暂定内容均按源方案标注

## GitHub Pages 发布

将本项目上传到新建的公开仓库 `herkyherky.github.io`，默认分支为 `main`。

推荐在该仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。随后运行 `Deploy static site to GitHub Pages` 工作流。工作流也会尝试自动开启 Pages；若 GitHub 限制自动开启，手动选择上述 Source 后在 Actions 中重新运行工作流即可。

也可选择 **Deploy from a branch → main → / (root) → Save**，直接发布根目录静态文件。此时可以不使用 Actions 工作流。

发布成功后预期地址为 `https://herkyherky.github.io/`；最终地址与部署状态以 GitHub Pages 设置页为准。

## 更新内容

`index.html` 为完整独立页面，可直接在浏览器中打开。源方案全文嵌入在 `original-plan` JSON 节点中，用于全文阅读与下载；`management-plan.txt` 为原始文本备份。修改时需同时检查摘要与原文，避免规则不一致。

本页面为方案导览。专项豁免以学院 / 学工批准、备案、公示为前提，不代表已经批准执行。
