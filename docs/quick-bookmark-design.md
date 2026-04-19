# 快速收藏书签功能设计文档

## 1. 功能概述

### 1.1 需求背景
浏览器自带的收藏弹窗（`chrome.bookmarks` 默认 UI）存在以下体验问题：
- 收藏目录使用**下拉框**展示，层级一深就难以快速定位
- 文件夹多时需要频繁滚动，操作效率低
- 视觉上不够直观，无法一眼看到所有可选位置

### 1.2 目标
点击浏览器工具栏上的 TabMark 插件图标，弹出一个**大尺寸的卡片式收藏窗口**，让用户可以：
- 快速编辑书签名称
- 通过**卡片网格 + 面包屑导航**直观浏览和选择保存目录
- 比浏览器默认收藏体验更快、更直观

## 2. 使用方式

| 操作 | 效果 |
|------|------|
| 点击插件图标 | 弹出收藏弹窗（popup） |
| 点击卡片 | **选中**该文件夹作为保存位置 |
| 点击卡片右上角箭头 | **进入**该文件夹，查看其子文件夹 |
| 点击面包屑中的某一级 | 回退到该层级 |
| 点击最前面的"当前文件夹"卡片 | 将书签保存到当前所在层级 |
| 快捷键 `Alt+B` / `Command+B` | 打开/关闭侧边栏（保留原功能） |

### 2.1 界面布局

弹窗尺寸 **800×600px**（浏览器允许的最大尺寸），采用**左右分栏布局**：

```
+-----------+-------------------------------------------+
|           |                                           |
| [图标]    | [folder_open] 选择文件夹    5个文件夹     |
| 添加到书签| home > 书签栏 > 技术文章                  |
|           |                                           |
| 名称      |  +--------+ +--------+ +--------+        |
| [______]  |  |当前文件| | AI开发  | | 前端    |        |  <-- 卡片网格
|           |  |保存到此| |3个子目录| |2个书签  |        |
| 网址      |  +--------+ +--------+ +--------+        |
| [url  ]   |  +--------+ +--------+                  |
| (只读)    |  | 后端   | | 开源项目|                  |
|           |  +--------+ +--------+                  |
|           |                                           |
|           | [check_circle] 将保存到：书签栏 / 技术文章 |  <-- 选中提示
|           |                                           |
|           +-------------------------------------------+
|                                         |
|      [ 取消 ] [ 保存 ]                  |
+-----------+-----------------------------+
     300px             500px
     左侧面板           右侧面板（文件夹选择区）
```

| 区域 | 说明 |
|------|------|
| **左侧（300px）** | 标题、名称输入框、网址输入框（只读）、保存/取消按钮 |
| **右侧（flex:1）** | 「保存位置」文件夹选择区，独占剩余全部高度 |

## 3. 实现原理

### 3.1 核心改动点

```
manifest.json
  └─ action.default_popup → 指定点击图标时打开 popup.html

src/popup.html + src/popup.js
  └─ 收藏弹窗的 UI 和交互逻辑（新增文件）

src/background.js
  └─ 无需修改，已保留注释说明：`action.default_popup` 设置后 `chrome.action.onClicked` 不再触发
```

### 3.2 数据流

```
用户点击图标
    │
    ▼
chrome.action.default_popup 打开 popup.html
    │
    ▼
popup.js 执行：
  1. chrome.tabs.query 获取当前标签页标题和 URL
  2. chrome.bookmarks.getTree 加载完整书签树
  3. 默认进入"书签栏"（id="1"），渲染子文件夹卡片
  4. 默认选中当前所在文件夹
    │
    ▼
用户交互（点击卡片 / 面包屑 / 保存按钮）
    │
    ├─ 选中卡片 → 高亮显示，更新底部提示
    ├─ 点击箭头 → enterFolder() 进入子级，重新渲染卡片
    ├─ 点击面包屑 → 回退到对应层级
    └─ 点击保存 → chrome.bookmarks.create 创建书签
                      chrome.runtime.sendMessage 通知刷新
                      800ms 后自动关闭弹窗
```

### 3.3 关键状态

| 状态变量 | 作用 |
|----------|------|
| `bookmarkTreeData` | 缓存完整书签树，避免重复查询 |
| `currentFolderId` | 当前所在的文件夹 ID（决定卡片显示内容） |
| `breadcrumbPath` | 面包屑路径数组，支持回退 |
| `selectedFolderId` | 用户最终选中的保存目标文件夹 ID |
| `selectedFolderPath` | 选中文件夹的完整路径字符串（用于底部提示） |

## 4. 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/popup.html` | 新增 | 弹窗页面结构，含卡片网格布局、面包屑、表单 |
| `src/popup.js` | 新增 | 弹窗交互逻辑，含书签树加载、卡片渲染、保存操作 |
| `manifest.json` | 修改 | `action` 字段增加 `default_popup: "src/popup.html"` |
| `src/background.js` | 无需修改 | 保留原有功能，`chrome.action.onClicked` 在设置了 `default_popup` 后不再触发（已有注释说明） |

## 5. 关键代码逻辑

### 5.1 进入文件夹并渲染卡片

```javascript
function enterFolder(folderId, folderTitle) {
  currentFolderId = folderId;

  // 更新面包屑：如果路径中已存在则截断，否则追加
  const existingIndex = breadcrumbPath.findIndex(p => p.id === folderId);
  if (existingIndex >= 0) {
    breadcrumbPath = breadcrumbPath.slice(0, existingIndex + 1);
  } else {
    breadcrumbPath.push({ id: folderId, title: folderTitle });
  }

  renderBreadcrumb();

  // 查找该文件夹下的子文件夹（过滤掉书签条目，只保留有 children 的节点）
  const children = findFolderChildren(bookmarkTreeData, folderId);
  renderFolderCards(children);
}
```

### 5.2 渲染卡片网格

每张卡片包含三种交互区域：
- **整张卡片点击** → 选中该文件夹
- **右上角箭头点击** → 进入该文件夹的子级（仅 `hasChildren` 时显示）
- **左上角勾选图标** → 选中状态下显示

```javascript
function createFolderCard(folder, isCurrentFolder) {
  // isCurrentFolder = true 时渲染虚线边框的"当前文件夹"卡片
  // hasChildren 时渲染可点击的箭头
  // selectedFolderId === folder.id 时显示绿色边框 + 勾选标记
}
```

### 5.3 保存书签

```javascript
chrome.bookmarks.create({
  parentId: selectedFolderId,
  title: title,
  url: url
}, (result) => {
  // 发送消息通知 background.js / 新标签页刷新书签显示
  chrome.runtime.sendMessage({ action: 'fetchBookmarks' });
  // 延迟关闭弹窗，给用户看到 toast 提示的时间
  setTimeout(() => window.close(), 800);
});
```

## 6. 设计决策

### 6.1 为什么用卡片网格而不是树形列表？
- 浏览器默认下拉框在深层级时容易迷失方向
- 卡片可以一眼看到当前层级所有可选文件夹
- 面包屑导航明确标示当前位置，回退操作直观

### 6.2 为什么添加"当前文件夹"卡片？
- 用户进入子文件夹后，需要一种方式将书签保存到**当前所在的这一层**
- 虚线边框与普通卡片区分，避免和子文件夹混淆

### 6.3 为什么默认进入"书签栏"？
- 绝大多数用户的书签都存放在书签栏（id="1"）
- 减少用户进入弹窗后需要再点一次才能看到常用文件夹的步骤

### 6.4 侧边栏切换功能怎么办？
- 原 `chrome.action.onClicked` 在设置了 `default_popup` 后不再触发
- 侧边栏切换改用**快捷键** `Alt+B` / `Command+B`（manifest 中 `commands.open_side_panel`）
- 在 background.js 中保留 `toggleSidePanel()` 和 `chrome.commands.onCommand` 监听

### 6.5 为什么改为左右分栏布局？

原始上下布局在 800×600px 的限制下，文件夹卡片区高度仅约 180px，只能展示 1~2 行卡片。改为左右分栏后：

| 布局 | 卡片区高度 | 可展示行数 | 问题 |
|------|-----------|-----------|------|
| 上下布局 | ~180px | 1~2 行 | 文件夹一多就要频繁滚动 |
| 左右分栏 | ~440px | 3~4 行 | 一次可见更多文件夹，操作更高效 |

- 左侧 300px 固定宽度放表单和按钮，右侧剩余空间全部给文件夹选择区
- 充分利用浏览器允许的最大弹窗尺寸，在不增加尺寸限制的前提下最大化可用空间

## 7. 后续可扩展点

| 扩展方向 | 描述 |
|----------|------|
| 最近使用文件夹 | 在顶部增加一行"最近使用的文件夹"快捷入口 |
| 搜索文件夹 | 在面包屑下方增加搜索框，支持按名称过滤文件夹 |
| 新建文件夹 | 在卡片区域增加"+ 新建文件夹"卡片 |
| 标签/备注 | 在保存时支持添加标签或备注 |
| 快捷保存 | 双击卡片直接保存并关闭弹窗 |
| 记住上次位置 | 记录用户上次保存的文件夹，下次默认选中 |
