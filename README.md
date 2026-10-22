# ACM 集训队 · 从思考，到突破

网站：<https://herkyherky.github.io/>

原生 HTML / CSS / JavaScript 静态网站，GitHub Pages 从 main 分支根目录发布。无需安装依赖或构建，无第三方字体、脚本或图片请求。

## 页面与交互

- 管理方案导览、12 章全文阅读与原文下载。
- 训练时间：每周一至周四、周日 **19:00–21:00，每次 2 小时**。其他安排以方案为准。
- 分屏动画、算法线框、阅读进度；向下滑隐藏顶部导航，向上滑恢复。支持减少动态效果偏好和手动开关。
- 竞赛情况：按场次查看模拟赛榜单、AC 数、得分、罚时与个人复盘。
- 个人资料：成员职责、年级、算法平台主页，逐月日历与每天的时长、刷题、具体题目、产出及比赛记录。

## 数据维护与统一发布

所有访客默认查看 team-data.json。目前仅录入源方案明确的三位负责人；未提供的比赛和日报为空，没有虚构训练成绩。

1. 打开「竞赛情况 / 个人资料 → 数据维护」。
2. 录入成员、每日训练、模拟赛成绩；保存为当前浏览器的**本机草稿**。
3. 检查草稿中的榜单和个人档案。
4. 在「导入与发布」导出 team-data.json。
5. 使用本仓库 Add file → Upload files 上传替换同名文件，提交到 main。
6. 等待 Pages 部署完成，刷新后所有人查看统一公开数据。

页面不会直接写入 GitHub，也不保存密码或访问令牌。任何访客均可编辑自己的本机草稿，公开数据由具有仓库写权限的负责人发布。本机草稿不跨设备同步；刷新后默认显示公开版，可在「导入与发布」继续本机草稿。

草稿基于旧版公开数据时会提示核对；发布前保留其他人的新记录。导入会替换本机草稿并要求确认，可先导出备份。支持导出逐日明细 CSV。

## 统计口径

- 同一成员同一天只保留一份日报，再次保存更新原日报。
- 日常 AC 按独立题目计数，不含比赛；日常提交同样不含比赛。
- 比赛 AC 按参赛记录累计，单独显示；同题跨场出现不代表独立题数。
- 当日总训练时长包含比赛，只在日报中记一次，不再叠加比赛时长。
- 无日报不等于训练为零；区分未记录、仅竞赛记录、已填日报。
- ICPC 按 AC 降序、罚时升序；积分制按得分降序、罚时升序；官方名次直接展示录入值。
- 同分同罚时按 1、1、3 并列。CF 等赛事可录入官方名次。罚时沿用原赛制单位，不跨场比较。

## 数据格式

schemaVersion 为 1，包含 members、daily、contests 数组。

- members：id, name, role, grade, bio, accounts（codeforces / luogu / nowcoder / leetcode / other）。
- daily：id, memberId, date, minutes, practiceSolved, submitted, topics, problems, output, review。
- contests：id, title, date, platform, format（ICPC / SCORE / OFFICIAL）, url, notes, results。
- results：memberId, solved, score, penalty, officialRank, review。

日期为 YYYY-MM-DD。修改姓名时保留成员 ID。导入会校验引用、重复日报、计数和日期。只填写用于公开展示的训练资料。

## 文件

index.html 为导览及管理方案全文；team.css / team.js 为训练档案模块；team-data.json 为公开数据；management-plan.txt 为对应文本备份；.nojekyll 用于直接提供静态文件。

修改规则时同步导览、内嵌全文和文本备份。专项豁免仍以学院 / 学工批准、备案、公示为前提。
