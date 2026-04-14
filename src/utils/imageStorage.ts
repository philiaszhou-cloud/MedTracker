/**
 * imageStorage.ts
 * 图片持久化工具 v2
 *
 * 主要修复：
 * 1. App 端：plus.io 文件操作极不稳定，改用 uni.saveFile（最可靠的本地持久化）
 *    回退链：uni.saveFile → plus.io.copyTo → base64 base64写入 → 返回临时路径
 * 2. H5 端：persistImage 同时返回 blob URL（可直接用于 <image>），也将 blob 存入
 *    IndexedDB 以便跨会话恢复。存储格式为 idb://key，加载时调用 loadImageFromStorage。
 * 3. 新增 resolveDisplayUrl：统一将任意格式的图片路径转换为可直接显示的 URL
 */

const PHOTO_DIR = 'med_photos';
const DB_NAME = 'med_photos_db';
const STORE_NAME = 'photos';
const DB_VERSION = 1;
const PERSISTED_IMAGES_KEY = 'medtracker_persisted_images';

// ─── IndexedDB 初始化 ──────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = (e: any) => resolve(e.target.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ─── 持久化入口 ───────────────────────────────────────────────────────────

/**
 * 将临时图片路径持久化，返回永久可访问的路径。
 *
 * - App 端：返回 savedFiles 路径（可直接用于 <image>，重启后依然有效）
 * - H5 端：返回 idb://key（需通过 loadImageFromStorage 还原 blob URL 才能显示）
 * - 如果已经是持久路径，直接返回原路径
 */
export function persistImage(tempPath: string): Promise<string> {
  if (!tempPath) return Promise.resolve('');
  if (isAlreadyPersisted(tempPath)) return Promise.resolve(tempPath);

  // #ifdef APP-PLUS
  return persistImageApp(tempPath);
  // #endif

  // #ifdef MP-WEIXIN || MP-ALIPAY || MP-BAIDU || MP-TOUTIAO || MP-QQ
  return persistImageMp(tempPath);
  // #endif

  // #ifdef H5
  return persistImageH5(tempPath);
  // #endif

  // 兜底返回，避免TypeScript编译错误
  return Promise.resolve(tempPath);
}

export function isPersistentImagePath(path: string): boolean {
  if (!path) return false;
  return isAlreadyPersisted(path);
}

/**
 * 判断路径是否已经是持久路径（避免重复处理）
 *
 * ★ v12 重要修复：移除对 data:image 的判断！
 * 原因：
 *   - 旧代码将 data:image 开头的路径视为"已持久化"，跳过磁盘写入
 *   - 但 data URL 是内存中的内联数据，重启 App 后会丢失
 *   - 正确做法：data URL 应该走 persistImage 流程，由调用方决定是否需要持久化
 *   - 调用方（add.vue）应存储持久化路径，而非将 data URL 直接存入 form
 */
function isAlreadyPersisted(path: string): boolean {
  return (
    path.includes('_doc/') ||
    path.includes('savedFiles') ||
    path.includes('wxfile://') ||
    path.includes(PHOTO_DIR) ||
    path.startsWith('idb://')
    // blob: 和 data:image 不再被视为已持久化
    // 因为它们是临时的内存数据，不保证跨会话存在
  );
}

// ─── App-Plus 实现 ────────────────────────────────────────────────────────

/**
 * App 端：使用 uni.saveFile 将临时文件存入本地持久缓存
 * savedFiles 目录是 uni-app 官方持久目录，App 卸载前永久保留
 */
function persistImageApp(tempPath: string): Promise<string> {
  return new Promise((resolve) => {
    let settled = false;
    const safeResolve = (path: string) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(path);
      }
    };

    // 10秒超时保护：防止 uni.saveFile 或 plus.io 静默失败导致Promise永远不resolve
    const timer = setTimeout(() => {
      console.warn('[imageStorage] persistImageApp 超时(10s)，返回临时路径');
      safeResolve(tempPath);
    }, 10000);

    // 方案一：uni.saveFile（官方 API，最可靠）
    uni.saveFile({
      tempFilePath: tempPath,
      success: (res) => {
        if (res.savedFilePath && typeof res.savedFilePath === 'string') {
          console.log('[imageStorage] App 端保存成功:', res.savedFilePath);
          // 记录已持久化路径，便于统一清理
          try { addPersistedImagePath(res.savedFilePath); } catch (e) {}
          safeResolve(res.savedFilePath);
        } else {
          console.warn('[imageStorage] uni.saveFile 返回路径无效，尝试 plus.io:', res);
          persistImageAppPlusIO(tempPath).then(safeResolve);
        }
      },
      fail: (err) => {
        console.warn('[imageStorage] uni.saveFile 失败，尝试 plus.io:', err);
        persistImageAppPlusIO(tempPath).then((p) => { try { addPersistedImagePath(p); } catch{}; safeResolve(p); });
      },
    });
  });
}

/** plus.io 方案（uni.saveFile 的 fallback） */
function persistImageAppPlusIO(tempPath: string): Promise<string> {
  return new Promise((resolve) => {
    let settled = false;
    const safeResolve = (path: string) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(path);
      }
    };

    // 8秒超时保护
    const timer = setTimeout(() => {
      console.warn('[imageStorage] persistImageAppPlusIO 超时(8s)，返回临时路径');
      safeResolve(tempPath);
    }, 8000);

    try {
      const ext = getExtFromPath(tempPath);
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;

      plus.io.resolveLocalFileSystemURL(
        '_doc/',
        (docEntry) => {
          (docEntry as any).getDirectory(
            PHOTO_DIR,
            { create: true },
            (photoDir: any) => {
              plus.io.resolveLocalFileSystemURL(
                tempPath,
                (srcEntry) => {
                  (srcEntry as any).copyTo(
                    photoDir,
                    fileName,
                    (newEntry: any) => {
                      const newPath = newEntry.toLocalURL();
                      console.log('[imageStorage] plus.io 复制成功:', newPath);
                      try { addPersistedImagePath(newPath); } catch (e) {}
                      safeResolve(newPath);
                    },
                    () => {
                      console.warn('[imageStorage] plus.io copyTo 失败，返回临时路径');
                      safeResolve(tempPath);
                    },
                  );
                },
                () => {
                  console.warn('[imageStorage] 无法解析 srcPath，返回临时路径');
                  safeResolve(tempPath);
                },
              );
            },
            () => {
              console.warn('[imageStorage] 无法创建目录，返回临时路径');
              safeResolve(tempPath);
            },
          );
        },
        () => {
          console.warn('[imageStorage] 无法访问 _doc，返回临时路径');
          safeResolve(tempPath);
        },
      );
    } catch (e) {
      console.error('[imageStorage] plus.io 异常:', e);
      safeResolve(tempPath);
    }
  });
}

// ─── H5 实现 ──────────────────────────────────────────────────────────────

/**
 * H5 端：将图片存入 IndexedDB，返回 idb://key
 * 注意：保存后需通过 loadImageFromStorage(key) 获取可显示的 blob URL
 */
function persistImageH5(tempPath: string): Promise<string> {
  return new Promise((resolve) => {
    // 已是 blob: 或 data: 开头，直接存 IndexedDB
    const blobOrData = tempPath.startsWith('blob:') || tempPath.startsWith('data:');
    
    if (blobOrData) {
      // 对于 blob: 或 data: URL，使用 fetch 获取 blob
      fetch(tempPath)
        .then(res => res.blob())
        .then(blob => storeBlobH5(blob))
        .then((key) => {
          if (key) {
            console.log('[imageStorage] H5 端存入 IndexedDB:', key);
            resolve(key);
          } else {
            resolve(tempPath);
          }
        })
        .catch(() => resolve(tempPath));
    } else {
      // 对于本地文件路径，直接返回临时路径
      // 因为在H5端，浏览器禁止fetch访问本地文件系统路径
      console.log('[imageStorage] H5 端：本地文件路径，直接返回临时路径');
      resolve(tempPath);
    }
  });
}

/** 将 blob 存入 IndexedDB，返回 idb://key */
function storeBlobH5(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    openDB().then((db) => {
      if (!db) { resolve(null); return; }
      const key = `idb://${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(blob, key);
        req.onsuccess = () => resolve(key);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

// ─── 小程序实现 ───────────────────────────────────────────────────────────

function persistImageMp(tempPath: string): Promise<string> {
  return new Promise((resolve) => {
    uni.saveFile({
      tempFilePath: tempPath,
      success: (res) => resolve(res.savedFilePath),
      fail: () => resolve(tempPath),
    });
  });
}

// ─── 读取照片（H5 IndexedDB → blob URL）─────────────────────────────────

/**
 * 从 IndexedDB 读取图片 blob，返回可直接用于 <image> 的 blob URL。
 * - 如果 key 是 idb:// 格式，从 IndexedDB 读取 blob 并返回 blob URL
 * - 否则直接返回原路径（App 端的 savedFiles 路径可直接使用）
 */
export function loadImageFromStorage(key: string): Promise<string> {
  if (!key) return Promise.resolve('');

  // 非 idb:// 格式（App 端 savedFiles 路径、临时路径等）直接返回
  if (!key.startsWith('idb://')) {
    return Promise.resolve(key);
  }

  // H5 端：从 IndexedDB 读取
  return new Promise((resolve) => {
    openDB().then((db) => {
      if (!db) { resolve(key); return; }
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result instanceof Blob) {
            resolve(URL.createObjectURL(req.result));
          } else {
            console.warn('[imageStorage] IndexedDB 未找到 blob for key:', key);
            resolve(key);
          }
        };
        req.onerror = () => resolve(key);
      } catch {
        resolve(key);
      }
    });
  });
}

/**
 * 统一将任意格式的图片路径解析为可直接显示的 URL。
 *
 * 使用场景：页面拿到 idb://xxx 或 _doc/... 路径时统一处理。
 * - idb:// → 从 IndexedDB 读取 blob URL（H5）
 * - 其他 → 直接返回原路径（App savedFiles、临时路径等均可显示）
 */
export async function resolveDisplayUrl(path: string): Promise<string> {
  if (!path) return '';
  return loadImageFromStorage(path);
}

// ─── App 端：本地文件 → base64 data URL ─────────────────────────────────────

/**
 * 将本地图片文件转换为 base64 data URL（App 端专用）
 *
 * 解决的问题：
 * - App 端 <image :src="localPath"> 可能渲染黑屏（WebView 安全策略）
 * - App 端 new Image().src = localPath 在 WebView 中静默失败
 * - data URL 是内联协议，WebView 100% 支持且不受安全限制
 *
 * 使用 plus.io 读取文件（uni-app App 端原生 API，非小程序 API）：
 *   plus.io.resolveLocalFileSystemURL → FileReader.readAsDataURL
 *
 * @param filePath 本地文件路径（tempPath 或 savedFiles 路径均可）
 * @returns base64 data URL 字符串，失败返回空字符串
 */
export function fileToDataUrl(filePath: string): Promise<string> {
  if (!filePath) return Promise.resolve('');
  // 如果已经是 data URL 或 blob URL，直接返回
  if (filePath.startsWith('data:image') || filePath.startsWith('blob:')) {
    return Promise.resolve(filePath);
  }

  return new Promise<string>((resolve) => {
    // 外层超时保护：8秒后自动返回空字符串，防止 plus.io 静默失败导致Promise永远不resolve
    let settled = false;
    const outerTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[imageStorage] fileToDataUrl 外层超时(8s)');
        resolve('');
      }
    }, 8000);

    const safeResolve = (result: string) => {
      if (!settled) {
        settled = true;
        clearTimeout(outerTimer);
        resolve(result);
      }
    };

    // #ifdef APP-PLUS
    try {
      plus.io.resolveLocalFileSystemURL(
        filePath,
        (entry: any) => {
          // entry 是 FileEntry 对象，调用 file() 获取 File 对象
          entry.file(
            (file: any) => {
              const reader = new FileReader();
              // 添加超时保护：5秒后自动返回空字符串
              const timeout = setTimeout(() => {
                reader.abort();
                console.warn('[imageStorage] fileToDataUrl 超时(5s)');
                safeResolve('');
              }, 5000);
              
              reader.onloadend = () => {
                clearTimeout(timeout);
                const result = reader.result as string;
                if (result && result.startsWith('data:')) {
                  safeResolve(result);
                } else {
                  console.warn('[imageStorage] fileToDataUrl 结果非 data URL');
                  safeResolve('');
                }
              };
              reader.onerror = (err: any) => {
                clearTimeout(timeout);
                console.warn('[imageStorage] FileReader 失败:', err);
                safeResolve('');
              };
              reader.readAsDataURL(file);
            },
            (fileErr: any) => {
              console.warn('[imageStorage] entry.file() 失败，回退到 XMLHttpRequest');
              // fallback：尝试用 XMLHttpRequest 读取
              try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', filePath, true);
                xhr.responseType = 'blob';
                const xhrTimeout = setTimeout(() => {
                  xhr.abort();
                  console.warn('[imageStorage] XMLHttpRequest 超时');
                  safeResolve('');
                }, 5000);
                
                xhr.onload = () => {
                  clearTimeout(xhrTimeout);
                  if (xhr.status === 200 || xhr.status === 0) {
                    const blob = xhr.response as Blob;
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      const result = reader.result as string;
                      safeResolve(result && result.startsWith('data:') ? result : '');
                    };
                    reader.onerror = () => {
                      console.warn('[imageStorage] XMLHttpRequest fallback FileReader 失败');
                      safeResolve('');
                    };
                    reader.readAsDataURL(blob);
                  } else {
                    console.warn(`[imageStorage] XMLHttpRequest 返回 ${xhr.status}`);
                    safeResolve('');
                  }
                };
                xhr.onerror = () => {
                  clearTimeout(xhrTimeout);
                  console.warn('[imageStorage] XMLHttpRequest 请求失败');
                  safeResolve('');
                };
              } catch (xhrErr) {
                console.warn('[imageStorage] XMLHttpRequest 异常:', xhrErr);
                safeResolve('');
              }
            },
          );
        },
        (resolveErr: any) => {
          console.warn('[imageStorage] resolveLocalFileSystemURL 失败:', resolveErr);
          safeResolve('');
        },
      );
    } catch (e) {
      console.warn('[imageStorage] fileToDataUrl 异常:', e);
      safeResolve('');
    }
    // #endif

    // H5 端：直接返回路径（浏览器不支持本地文件读取）
    // #ifndef APP-PLUS
    safeResolve(filePath);
    // #endif
  });
}

// ─── 删除 ──────────────────────────────────────────────────────────────────

/**
 * 删除持久化目录中的某张图片
 */
export function deletePersistedImage(persistedPath: string): void {
  if (!persistedPath) return;

  // #ifdef APP-PLUS
  if (isAlreadyPersisted(persistedPath) && !persistedPath.startsWith('idb://')) {
    try {
      // 尝试通过 uni.removeSavedFile 删除（savedFiles 目录）
      uni.removeSavedFile({
        filePath: persistedPath,
        success: () => {
          console.log('[imageStorage] 已删除持久文件:', persistedPath);
          try { removePersistedImagePath(persistedPath); } catch (e) { console.error('[imageStorage] 移除持久化路径失败:', e); }
        },
        fail: () => {
          // 如果是 _doc 目录的文件，用 plus.io 删除
          try {
            plus.io.resolveLocalFileSystemURL(
              persistedPath,
              (entry) => (entry as any).remove(() => { try { removePersistedImagePath(persistedPath); } catch (e) {} }, () => {}),
              () => {},
            );
          } catch {}
        },
      } as any);
    } catch {}
  }
  // #endif

  // #ifdef H5
  if (persistedPath.startsWith('idb://')) {
    openDB().then((db) => {
      if (!db) return;
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(persistedPath);
      } catch {}
    });
  }
  // #endif

  // #ifdef MP-WEIXIN || MP-ALIPAY || MP-BAIDU || MP-TOUTIAO || MP-QQ
  try {
    uni.removeSavedFile({ filePath: persistedPath, fail: () => {} } as any);
  } catch {}
  // #endif
}

export function clearAllImageData(): Promise<void> {
  return new Promise((resolve) => {
    // #ifdef H5
    openDB().then((db) => {
      if (!db) {
        resolve();
        return;
      }
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => {
          console.log('[imageStorage] IndexedDB 已清空');
          resolve();
        };
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    // #endif

    // #ifdef APP-PLUS
    try {
      // 1) 先尝试删除通过 uni.saveFile 保存的 savedFiles 路径（我们在 persistImage 时已记录）
      const persisted: string[] = getPersistedImagePaths();
      const removeNext = (i: number) => {
        if (i >= persisted.length) {
          // 2) 再删除 _doc/PHOTO_DIR 下的文件（fallback）
          try {
            plus.io.resolveLocalFileSystemURL(
              '_doc/',
              (docEntry) => {
                (docEntry as any).getDirectory(
                  PHOTO_DIR,
                  { create: false },
                  (photoDir: any) => {
                    (photoDir as any).removeRecursively(
                      () => {
                        console.log('[imageStorage] _doc/med_photos 已清空');
                        // 清空 persisted list
                        try { clearPersistedImagePaths(); } catch (e) {}
                        resolve();
                      },
                      () => resolve(),
                    );
                  },
                  () => resolve(),
                );
              },
              () => resolve(),
            );
          } catch {
            resolve();
          }
          return;
        }

        const p = persisted[i];
        try {
          uni.removeSavedFile({
            filePath: p,
            success: () => {
              try { removePersistedImagePath(p); } catch (e) {}
              removeNext(i + 1);
            },
            fail: () => {
              // 如果无法通过 uni.removeSavedFile 删除，尝试 plus.io
              try {
                plus.io.resolveLocalFileSystemURL(
                  p,
                  (entry: any) => {
                    (entry as any).remove(() => { try { removePersistedImagePath(p); } catch (e) {} removeNext(i + 1); }, () => removeNext(i + 1));
                  },
                  () => removeNext(i + 1),
                );
              } catch {
                removeNext(i + 1);
              }
            },
          } as any);
        } catch {
          removeNext(i + 1);
        }
      };

      removeNext(0);
    } catch {
      resolve();
    }
    // #endif

    // #ifndef APP-PLUS || H5
    resolve();
    // #endif
  });
}

function getExtFromPath(path: string): string {
  const match = path.match(/(\.\w{2,5})(?:\?|$)/);
  if (match) return match[1];
  return '.jpg';
}

// ===== 持久化路径列表管理 =====
function getPersistedImagePaths(): string[] {
  try {
    const raw = uni.getStorageSync(PERSISTED_IMAGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw as string);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function savePersistedImagePaths(list: string[]) {
  try {
    uni.setStorageSync(PERSISTED_IMAGES_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('[imageStorage] 保存持久化路径列表失败:', e);
  }
}

function addPersistedImagePath(p: string) {
  if (!p) return;
  try {
    const list = getPersistedImagePaths();
    if (!list.includes(p)) {
      list.push(p);
      savePersistedImagePaths(list);
    }
  } catch (e) {}
}

function removePersistedImagePath(p: string) {
  if (!p) return;
  try {
    const list = getPersistedImagePaths();
    const idx = list.indexOf(p);
    if (idx !== -1) {
      list.splice(idx, 1);
      savePersistedImagePaths(list);
    }
  } catch (e) {}
}

function clearPersistedImagePaths() {
  try { uni.removeStorageSync(PERSISTED_IMAGES_KEY); } catch (e) {}
}

// ─── Android 路径有效性检查（解决 savedFiles 路径失效问题，v9 新增） ──────

/**
 * ★ v9 新增功能：验证 Android savedFiles 路径是否仍有效，如果失效则尝试修复
 * 
 * 背景：Android 上 uni.saveFile() 返回的 savedFiles:// 路径在以下情况会失效：
 *   1. 某些 ROM 的缓存机制清理了临时文件
 *   2. App 版本升级导致存储目录变化
 *   3. 系统存储空间不足触发的清理
 * 
 * 解决方案：
 *   - 当读取已保存的图片时调用此函数验证路径有效性
 *   - 如果路径无效（文件不存在），则 **返回 null** 
 *   - 调用者可选择：提示用户重新拍摄，或从相册中选取
 */
export function verifyImagePath(imagePath: string): Promise<string | null> {
  if (!imagePath) return Promise.resolve(null);
  
  // 非 App 端直接返回
  // #ifndef APP-PLUS
  return Promise.resolve(imagePath);
  // #endif
  
  // #ifdef APP-PLUS
  return new Promise((resolve) => {
    // 非 savedFiles 路径直接返回（临时路径、data URL、blob URL 等）
    if (!imagePath.includes('savedFiles') && !imagePath.includes('_doc/')) {
      resolve(imagePath);
      return;
    }

    // 使用 plus.io.resolveLocalFileSystemURL 检查文件是否存在
    try {
      (plus.io as any).resolveLocalFileSystemURL(
        imagePath,
        () => {
          // 文件存在，返回原路径
          console.log('[imageStorage] 路径有效:', imagePath);
          resolve(imagePath);
        },
        () => {
          // 文件不存在，返回 null
          console.warn('[imageStorage] ★ 路径失效（文件不存在）:', imagePath);
          resolve(null);
        }
      );
    } catch (e) {
      console.warn('[imageStorage] 路径检查异常:', e);
      resolve(null);
    }
  });
  // #endif
  
  // 兜底（不会执行到，仅为 TypeScript）
  return Promise.resolve(imagePath);
}
