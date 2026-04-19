// 获取当前标签页信息
let currentTab = null;
let selectedFolderId = null;
let selectedFolderPath = '';

// 书签树数据缓存
let bookmarkTreeData = [];
let currentFolderId = null;
let breadcrumbPath = [];

// 图标 SVG
const FOLDER_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>`;
const CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.29 6.71c-.39.39-.39 1.02 0 1.41L13.17 12l-3.88 3.88c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l4.59-4.59c.39-.39.39-1.02 0-1.41L10.7 6.71c-.38-.39-1.02-.39-1.41 0z"/></svg>`;

document.addEventListener('DOMContentLoaded', async () => {
  // 获取当前活动标签页
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];

  if (currentTab) {
    document.getElementById('bookmark-title').value = currentTab.title || '';
    document.getElementById('bookmark-url').value = currentTab.url || '';
  }

  // 加载书签文件夹
  loadBookmarkFolders();

  // 绑定按钮事件
  document.getElementById('btn-cancel').addEventListener('click', () => {
    window.close();
  });

  document.getElementById('btn-save').addEventListener('click', saveBookmark);

  // 回车保存
  document.getElementById('bookmark-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveBookmark();
    }
  });
});

// 加载书签文件夹
function loadBookmarkFolders() {
  chrome.bookmarks.getTree((tree) => {
    if (!tree || !tree[0] || !tree[0].children) {
      document.getElementById('folder-cards').innerHTML = '<div class="empty-state">无法加载文件夹</div>';
      return;
    }

    bookmarkTreeData = tree[0].children;

    // 默认选中第一个根文件夹（通常是书签栏，id为"1"）
    const bookmarksBar = bookmarkTreeData.find(n => n.id === '1');
    if (bookmarksBar) {
      selectedFolderId = bookmarksBar.id;
      selectedFolderPath = bookmarksBar.title;
      // 进入书签栏查看子文件夹
      enterFolder(bookmarksBar.id, bookmarksBar.title);
    } else if (bookmarkTreeData.length > 0) {
      selectedFolderId = bookmarkTreeData[0].id;
      selectedFolderPath = bookmarkTreeData[0].title;
      enterFolder(bookmarkTreeData[0].id, bookmarkTreeData[0].title);
    }

    updateSelectedFolderDisplay();
  });
}

// 进入某个文件夹，显示其子文件夹
function enterFolder(folderId, folderTitle) {
  currentFolderId = folderId;

  // 更新面包屑路径
  const existingIndex = breadcrumbPath.findIndex(p => p.id === folderId);
  if (existingIndex >= 0) {
    // 如果已经在路径中，截断到该位置
    breadcrumbPath = breadcrumbPath.slice(0, existingIndex + 1);
  } else {
    breadcrumbPath.push({ id: folderId, title: folderTitle });
  }

  renderBreadcrumb();

  // 查找当前文件夹的子文件夹
  const children = findFolderChildren(bookmarkTreeData, folderId);
  renderFolderCards(children);

  // 更新文件夹计数
  const folderCount = children.length;
  document.getElementById('folder-count').textContent = folderCount > 0 ? `${folderCount} 个文件夹` : '';
}

// 在书签树中查找某个文件夹的子节点
function findFolderChildren(nodes, folderId) {
  // 如果是根级别
  for (const node of nodes) {
    if (node.id === folderId) {
      return (node.children || []).filter(c => c.children); // 只返回文件夹
    }
    if (node.children) {
      const result = findFolderChildren(node.children, folderId);
      if (result) return result;
    }
  }
  return [];
}

// 在书签树中查找某个文件夹的信息
function findFolderInfo(nodes, folderId) {
  for (const node of nodes) {
    if (node.id === folderId) return node;
    if (node.children) {
      const result = findFolderInfo(node.children, folderId);
      if (result) return result;
    }
  }
  return null;
}

// 获取文件夹的完整路径
function getFolderPath(nodes, folderId, path = []) {
  for (const node of nodes) {
    if (node.id === folderId) {
      return [...path, node.title];
    }
    if (node.children) {
      const result = getFolderPath(node.children, folderId, [...path, node.title]);
      if (result) return result;
    }
  }
  return null;
}

// 渲染面包屑
function renderBreadcrumb() {
  const container = document.getElementById('breadcrumb');
  container.innerHTML = '';

  // 根按钮
  const rootBtn = document.createElement('button');
  rootBtn.className = 'breadcrumb-item breadcrumb-root';
  rootBtn.innerHTML = '<span class="material-icons" style="font-size:14px;">home</span>';
  rootBtn.addEventListener('click', () => {
    // 显示所有根文件夹
    breadcrumbPath = [];
    currentFolderId = null;
    renderBreadcrumb();
    const rootFolders = bookmarkTreeData.filter(n => n.children);
    renderFolderCards(rootFolders);
    document.getElementById('folder-count').textContent = rootFolders.length > 0 ? `${rootFolders.length} 个文件夹` : '';
  });
  container.appendChild(rootBtn);

  breadcrumbPath.forEach((item, index) => {
    // 分隔符
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.innerHTML = '›';
    container.appendChild(sep);

    // 路径项
    const btn = document.createElement('button');
    const isLast = index === breadcrumbPath.length - 1;
    btn.className = `breadcrumb-item ${isLast ? 'current' : ''}`;
    btn.textContent = item.title || '未命名';
    btn.dataset.folderId = item.id;

    if (!isLast) {
      btn.addEventListener('click', () => {
        enterFolder(item.id, item.title);
      });
    }

    container.appendChild(btn);
  });
}

// 渲染文件夹卡片
function renderFolderCards(folders) {
  const container = document.getElementById('folder-cards');
  container.innerHTML = '';

  // 如果有当前文件夹，先添加一个"当前文件夹"卡片
  if (currentFolderId) {
    const currentFolder = findFolderInfo(bookmarkTreeData, currentFolderId);
    if (currentFolder) {
      const currentCard = createFolderCard(currentFolder, true);
      container.appendChild(currentCard);
    }
  }

  if (folders.length === 0 && !currentFolderId) {
    container.innerHTML = '<div class="empty-state">此文件夹下没有子文件夹</div>';
    return;
  }

  folders.forEach(folder => {
    const card = createFolderCard(folder, false);
    container.appendChild(card);
  });
}

// 创建单个文件夹卡片
function createFolderCard(folder, isCurrentFolder) {
  const hasChildren = folder.children && folder.children.some(c => c.children);
  const childCount = folder.children ? folder.children.filter(c => c.children).length : 0;
  const bookmarkCount = folder.children ? folder.children.filter(c => c.url).length : 0;

  const card = document.createElement('div');
  const selectedClass = selectedFolderId === folder.id ? 'selected' : '';
  const currentClass = isCurrentFolder ? 'current-folder' : '';
  card.className = `folder-card ${selectedClass} ${currentClass} ${hasChildren ? 'has-children' : ''}`;
  card.dataset.id = folder.id;

  // 选中标记
  const checkHtml = `<div class="check-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>`;

  // 进入下一级的箭头
  let arrowHtml = '';
  if (hasChildren && !isCurrentFolder) {
    arrowHtml = `<div class="folder-card-arrow">${CHEVRON_RIGHT}</div>`;
  }

  // 名称
  const nameText = isCurrentFolder ? `📁 ${folder.title || '当前文件夹'}` : (folder.title || '未命名');

  // 数量提示
  let countText = '';
  if (bookmarkCount > 0) {
    countText = `${bookmarkCount} 个书签`;
  } else if (childCount > 0) {
    countText = `${childCount} 个子文件夹`;
  }
  if (isCurrentFolder) {
    countText = '保存到此处';
  }

  card.innerHTML = `
    ${checkHtml}
    ${arrowHtml}
    <div class="folder-card-icon">${FOLDER_ICON}</div>
    <div class="folder-card-name">${nameText}</div>
    ${countText ? `<div class="folder-card-count">${countText}</div>` : ''}
  `;

  // 点击卡片 = 选中该文件夹
  card.addEventListener('click', (e) => {
    // 如果点击的是箭头区域，进入子文件夹
    const arrow = card.querySelector('.folder-card-arrow');
    if (arrow && (arrow === e.target || arrow.contains(e.target))) {
      if (hasChildren) {
        enterFolder(folder.id, folder.title);
      }
      return;
    }

    // 否则选中该文件夹
    selectFolder(folder.id);
  });

  return card;
}

// 选中文件夹
function selectFolder(folderId) {
  selectedFolderId = folderId;

  // 获取完整路径
  const path = getFolderPath(bookmarkTreeData, folderId);
  if (path) {
    selectedFolderPath = path.join(' / ');
  } else {
    const folder = findFolderInfo(bookmarkTreeData, folderId);
    selectedFolderPath = folder ? folder.title : '';
  }

  // 更新卡片选中状态
  document.querySelectorAll('.folder-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === folderId);
  });

  updateSelectedFolderDisplay();
}

// 更新选中文件夹显示
function updateSelectedFolderDisplay() {
  const bar = document.getElementById('selected-folder-bar');
  const pathText = document.getElementById('selected-folder-path');

  if (selectedFolderId && selectedFolderPath) {
    pathText.textContent = `将保存到：${selectedFolderPath}`;
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
  }
}

// 保存书签
function saveBookmark() {
  const title = document.getElementById('bookmark-title').value.trim();
  const url = document.getElementById('bookmark-url').value.trim();

  if (!title) {
    document.getElementById('bookmark-title').focus();
    showToast('请输入书签名称', '#ef4444');
    return;
  }

  if (!url) {
    showToast('无法获取当前页面网址', '#ef4444');
    return;
  }

  if (!selectedFolderId) {
    showToast('请先选择文件夹', '#ef4444');
    return;
  }

  chrome.bookmarks.create({
    parentId: selectedFolderId,
    title: title,
    url: url
  }, (result) => {
    if (chrome.runtime.lastError) {
      showToast('保存失败: ' + chrome.runtime.lastError.message, '#ef4444');
      return;
    }

    showToast('已保存到书签');

    // 通知其他页面刷新书签显示
    chrome.runtime.sendMessage({ action: 'fetchBookmarks' });

    // 延迟关闭弹窗
    setTimeout(() => {
      window.close();
    }, 800);
  });
}

// 显示提示
function showToast(message, bgColor = '#10b981') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.backgroundColor = bgColor;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
