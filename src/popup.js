let selectedFolderId = null;

let bookmarkTreeData = [];
let currentFolderId = null;
let breadcrumbPath = [];

const BOOKMARKS_BAR_ID = '1';

const FOLDER_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg>`;
const CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.29 6.71c-.39.39-.39 1.02 0 1.41L13.17 12l-3.88 3.88c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0l4.59-4.59c.39-.39.39-1.02 0-1.41L10.7 6.71c-.38-.39-1.02-.39-1.41 0z"/></svg>`;

let selectedCard = null;
let contextMenuFolder = null;

document.addEventListener('DOMContentLoaded', async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  if (currentTab) {
    document.getElementById('bookmark-title').value = currentTab.title || '';
    document.getElementById('bookmark-url').value = currentTab.url || '';
  }

  loadBookmarkFolders();

  document.getElementById('btn-cancel').addEventListener('click', () => {
    window.close();
  });

  document.getElementById('btn-save').addEventListener('click', saveBookmark);
  document.getElementById('btn-create-folder').addEventListener('click', showCreateFolderPanel);
  document.getElementById('btn-confirm-create-folder').addEventListener('click', createFolder);
  document.getElementById('btn-cancel-create-folder').addEventListener('click', hideCreateFolderPanel);
  document.getElementById('btn-rename-folder').addEventListener('click', renameContextFolder);
  document.getElementById('btn-delete-folder').addEventListener('click', deleteContextFolder);
  document.addEventListener('click', hideFolderContextMenu);
  document.addEventListener('scroll', hideFolderContextMenu, true);

  document.getElementById('bookmark-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveBookmark();
    }
  });

  document.getElementById('new-folder-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      createFolder();
    }
    if (e.key === 'Escape') {
      hideCreateFolderPanel();
    }
  });
});

function loadBookmarkFolders() {
  chrome.bookmarks.getTree((tree) => {
    if (!tree || !tree[0] || !tree[0].children) {
      document.getElementById('folder-cards').innerHTML = '<div class="empty-state">无法加载文件夹</div>';
      return;
    }

    bookmarkTreeData = tree[0].children;

    const bookmarksBar = bookmarkTreeData.find(n => n.id === BOOKMARKS_BAR_ID);
    if (bookmarksBar) {
      selectedFolderId = bookmarksBar.id;
      enterFolder(bookmarksBar.id, bookmarksBar.title);
    } else if (bookmarkTreeData.length > 0) {
      selectedFolderId = bookmarkTreeData[0].id;
      enterFolder(bookmarkTreeData[0].id, bookmarkTreeData[0].title);
    }

    updateSelectedFolderDisplay();
  });
}

function enterFolder(folderId, folderTitle) {
  currentFolderId = folderId;
  selectedFolderId = folderId;

  const fullPath = getFolderPathItems(bookmarkTreeData, folderId);
  if (fullPath) {
    breadcrumbPath = fullPath;
  } else {
    const existingIndex = breadcrumbPath.findIndex(p => p.id === folderId);
    if (existingIndex >= 0) {
      breadcrumbPath = breadcrumbPath.slice(0, existingIndex + 1);
    } else {
      breadcrumbPath.push({ id: folderId, title: folderTitle });
    }
  }

  renderBreadcrumb();

  const children = findFolderChildren(bookmarkTreeData, folderId) || [];
  renderFolderCards(children);

  const folderCount = children.length;
  document.getElementById('folder-count').textContent = folderCount > 0 ? `${folderCount} 个文件夹` : '';
  updateSelectedFolderDisplay();
}

function findFolderChildren(nodes, folderId) {
  for (const node of nodes) {
    if (node.id === folderId) {
      return (node.children || []).filter(c => c.children);
    }
    if (node.children) {
      const result = findFolderChildren(node.children, folderId);
      if (result !== null) return result;
    }
  }
  return null;
}

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

function getFolderPathItems(nodes, folderId, path = []) {
  for (const node of nodes) {
    const nextPath = [...path, { id: node.id, title: node.title }];
    if (node.id === folderId) {
      return nextPath;
    }
    if (node.children) {
      const result = getFolderPathItems(node.children, folderId, nextPath);
      if (result) return result;
    }
  }
  return null;
}

function renderBreadcrumb() {
  const container = document.getElementById('breadcrumb');
  container.innerHTML = '';

  const rootBtn = document.createElement('button');
  rootBtn.className = 'breadcrumb-item breadcrumb-root';
  rootBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
  rootBtn.addEventListener('click', () => {
    breadcrumbPath = [];
    currentFolderId = null;
    renderBreadcrumb();
    const rootFolders = bookmarkTreeData.filter(n => n.children);
    renderFolderCards(rootFolders);
    document.getElementById('folder-count').textContent = rootFolders.length > 0 ? `${rootFolders.length} 个文件夹` : '';
  });
  container.appendChild(rootBtn);

  breadcrumbPath.forEach((item, index) => {
    const sep = document.createElement('span');
    sep.className = 'breadcrumb-separator';
    sep.innerHTML = '›';
    container.appendChild(sep);

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

function renderFolderCards(folders) {
  const container = document.getElementById('folder-cards');
  container.innerHTML = '';
  selectedCard = null;

  if (folders.length === 0) {
    container.innerHTML = '<div class="empty-state">此文件夹下没有子文件夹</div>';
    return;
  }

  folders.forEach(folder => {
    const card = createFolderCard(folder, false);
    container.appendChild(card);
    if (selectedFolderId === folder.id) {
      selectedCard = card;
    }
  });
}

function createFolderCard(folder, isCurrentFolder) {
  const hasChildren = folder.children && folder.children.some(c => c.children);
  const childCount = folder.children ? folder.children.filter(c => c.children).length : 0;
  const bookmarkCount = folder.children ? folder.children.filter(c => c.url).length : 0;

  const card = document.createElement('div');
  const selectedClass = selectedFolderId === folder.id ? 'selected' : '';
  const currentClass = isCurrentFolder ? 'current-folder' : '';
  card.className = `folder-card ${selectedClass} ${currentClass} ${hasChildren ? 'has-children' : ''}`;
  card.dataset.id = folder.id;

  const checkHtml = `<div class="check-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg></div>`;

  let arrowHtml = '';
  if (hasChildren && !isCurrentFolder) {
    arrowHtml = `<div class="folder-card-arrow">${CHEVRON_RIGHT}</div>`;
  }

  const nameText = isCurrentFolder ? `📁 ${folder.title || '当前文件夹'}` : (folder.title || '未命名');

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

  const arrow = card.querySelector('.folder-card-arrow');

  card.addEventListener('click', (e) => {
    if (arrow && (arrow === e.target || arrow.contains(e.target))) {
      if (hasChildren) {
        enterFolder(folder.id, folder.title);
      }
      return;
    }

    selectFolder(folder.id, card);
  });

  card.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    enterFolder(folder.id, folder.title);
  });

  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showFolderContextMenu(e, folder);
  });

  return card;
}

function selectFolder(folderId, cardElement) {
  selectedFolderId = folderId;

  if (selectedCard) {
    selectedCard.classList.remove('selected');
  }
  if (cardElement) {
    cardElement.classList.add('selected');
    selectedCard = cardElement;
  }

  updateSelectedFolderDisplay();
}

function updateSelectedFolderDisplay() {
  const bar = document.getElementById('selected-folder-bar');
  const pathText = document.getElementById('selected-folder-path');

  const path = getFolderPath(bookmarkTreeData, selectedFolderId);
  const displayPath = path ? path.join(' / ') : '';

  if (selectedFolderId && displayPath) {
    pathText.textContent = `将保存到：${displayPath}`;
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
  }
}

function showCreateFolderPanel() {
  const panel = document.getElementById('create-folder-panel');
  const input = document.getElementById('new-folder-name');
  panel.classList.add('show');
  input.value = '';
  requestAnimationFrame(() => input.focus());
}

function hideCreateFolderPanel() {
  const panel = document.getElementById('create-folder-panel');
  const input = document.getElementById('new-folder-name');
  panel.classList.remove('show');
  input.value = '';
}

function getCreateFolderParentId() {
  return currentFolderId || selectedFolderId || BOOKMARKS_BAR_ID;
}

function reloadBookmarkTree(callback) {
  chrome.bookmarks.getTree((tree) => {
    if (chrome.runtime.lastError || !tree || !tree[0] || !tree[0].children) {
      showToast('刷新目录失败', '#ef4444');
      return;
    }

    bookmarkTreeData = tree[0].children;
    callback();
  });
}

function refreshFolderView(folderId = currentFolderId) {
  if (folderId) {
    const folder = findFolderInfo(bookmarkTreeData, folderId);
    if (folder) {
      enterFolder(folder.id, folder.title);
      return;
    }
  }

  currentFolderId = null;
  breadcrumbPath = [];
  renderBreadcrumb();
  const rootFolders = bookmarkTreeData.filter(n => n.children);
  renderFolderCards(rootFolders);
  document.getElementById('folder-count').textContent = rootFolders.length > 0 ? `${rootFolders.length} 个文件夹` : '';
}

function isFolderEditable(folder) {
  return folder && !folder.unmodifiable;
}

function isFolderInSubtree(rootFolderId, targetFolderId) {
  const path = getFolderPathItems(bookmarkTreeData, targetFolderId);
  return Boolean(path && path.some(item => item.id === rootFolderId));
}

function showFolderContextMenu(event, folder) {
  if (!isFolderEditable(folder)) {
    showToast('该目录不支持修改', '#ef4444');
    return;
  }

  contextMenuFolder = folder;
  const menu = document.getElementById('folder-context-menu');
  menu.classList.add('show');

  const menuRect = menu.getBoundingClientRect();
  const left = Math.min(event.clientX, window.innerWidth - menuRect.width - 8);
  const top = Math.min(event.clientY, window.innerHeight - menuRect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

function hideFolderContextMenu() {
  const menu = document.getElementById('folder-context-menu');
  if (menu) {
    menu.classList.remove('show');
  }
}

function renameContextFolder(event) {
  event.stopPropagation();
  const folder = contextMenuFolder;
  hideFolderContextMenu();

  if (!isFolderEditable(folder)) {
    showToast('该目录不支持修改', '#ef4444');
    return;
  }

  const newTitle = prompt('请输入新的目录名称', folder.title || '');
  if (newTitle === null) return;

  const title = newTitle.trim();
  if (!title) {
    showToast('请输入目录名称', '#ef4444');
    return;
  }

  chrome.bookmarks.update(folder.id, { title }, () => {
    if (chrome.runtime.lastError) {
      showToast('重命名失败: ' + chrome.runtime.lastError.message, '#ef4444');
      return;
    }

    reloadBookmarkTree(() => {
      refreshFolderView(currentFolderId);
      if (selectedFolderId === folder.id) {
        updateSelectedFolderDisplay();
      }
      showToast('目录已重命名');
    });
  });
}

function deleteContextFolder(event) {
  event.stopPropagation();
  const folder = contextMenuFolder;
  hideFolderContextMenu();

  if (!isFolderEditable(folder)) {
    showToast('该目录不支持删除', '#ef4444');
    return;
  }

  const confirmed = confirm(`确定删除目录“${folder.title || '未命名'}”及其包含的所有书签吗？`);
  if (!confirmed) return;

  const fallbackFolderId = folder.parentId || BOOKMARKS_BAR_ID;
  const currentFolderWasDeleted = currentFolderId && isFolderInSubtree(folder.id, currentFolderId);
  const selectedFolderWasDeleted = selectedFolderId && isFolderInSubtree(folder.id, selectedFolderId);

  chrome.bookmarks.removeTree(folder.id, () => {
    if (chrome.runtime.lastError) {
      showToast('删除目录失败: ' + chrome.runtime.lastError.message, '#ef4444');
      return;
    }

    if (selectedFolderWasDeleted) {
      selectedFolderId = fallbackFolderId;
    }
    if (currentFolderWasDeleted) {
      currentFolderId = fallbackFolderId;
    }

    reloadBookmarkTree(() => {
      refreshFolderView(currentFolderId || fallbackFolderId);
      updateSelectedFolderDisplay();
      showToast('目录已删除');
    });
  });
}

function createFolder() {
  const input = document.getElementById('new-folder-name');
  const confirmButton = document.getElementById('btn-confirm-create-folder');
  const title = input.value.trim();

  if (!title) {
    input.focus();
    showToast('请输入目录名称', '#ef4444');
    return;
  }

  const parentId = getCreateFolderParentId();
  confirmButton.disabled = true;

  chrome.bookmarks.create({
    parentId,
    title
  }, (folder) => {
    confirmButton.disabled = false;

    if (chrome.runtime.lastError) {
      showToast('创建目录失败: ' + chrome.runtime.lastError.message, '#ef4444');
      return;
    }

    hideCreateFolderPanel();

    reloadBookmarkTree(() => {
      const parentFolder = findFolderInfo(bookmarkTreeData, folder.parentId);
      if (parentFolder) {
        enterFolder(parentFolder.id, parentFolder.title);
      } else {
        renderFolderCards(bookmarkTreeData.filter(n => n.children));
      }

      const newFolderCard = document.querySelector(`.folder-card[data-id="${folder.id}"]`);
      selectFolder(folder.id, newFolderCard);
      if (newFolderCard) {
        newFolderCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      showToast('目录已创建');
    });
  });
}

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

    chrome.runtime.sendMessage({ action: 'fetchBookmarks' }, () => {
      if (chrome.runtime.lastError) {
        // 无接收者时忽略错误
      }
    });

    setTimeout(() => {
      window.close();
    }, 800);
  });
}

function showToast(message, bgColor = '#10b981') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.backgroundColor = bgColor;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}
