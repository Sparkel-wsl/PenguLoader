# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目概述

Pengu Loader 是一个英雄联盟客户端的插件加载器。它通过注入到基于 CEF 的 LoL 客户端中，加载 JavaScript 插件并暴露原生 API。

## 前置条件

```bash
git submodule update --init   # 拉取 CEF 头文件（core/cef/）
cd plugins && pnpm install    # 安装前端依赖
```

## 构建

```bash
# 1. 构建预加载 JS（生成 plugins/dist/preload.g.h，用于嵌入 core.dll）
cd plugins && pnpm install && pnpm build && cd ..

# 2. 构建整个解决方案（输出到 bin/）
msbuild pengu.sln /t:Restore,Build /m /p:Configuration=Release /p:Platform=x64
```

### 单独构建各个组件

```bash
# 仅构建预加载脚本（Release）
cd plugins && pnpm build

# 仅构建预加载脚本（Debug，不做 minify）
cd plugins && pnpm build-dev

# 仅构建 core.dll（需要先构建预加载脚本生成 .h 头文件）
msbuild core/core.vcxproj -t:Build -p:Configuration=Release -p:Platform=x64

# 仅构建 WPF 启动器
dotnet build loader/loader.csproj -c Release -p:Platform="Any CPU"
```

开发时，先用 **Debug** 模式构建 core，然后运行 `pnpm dev` 实现热重载：

```bash
cd plugins && pnpm dev   # 开发服务器位于 localhost:3001，视图支持 HMR，预加载脚本变更会触发整页重载
```

> 如果只在修改 `preload/`，用 `pnpm build-dev` 更快，然后手动重载客户端即可。

## 解决方案结构

- `pengu.sln` — VS 2022 解决方案，包含两个项目
- `core/` — C++20 DLL (`core.dll`)，注入到 League Client 进程中。仅构建为 **x64**。
- `loader/` — .NET Framework 4.7.2 WPF 应用 (`Pengu Loader.exe`)，GUI 启动器。使用 ModernWpfUI。构建为 **AnyCPU**。
- `plugins/` — TypeScript/Vite/SolidJS 项目。构建预加载脚本和插件视图。

## 架构

### 注入机制

`core.dll` 通过以下两种方式之一加载到 `LeagueClientUx.exe` 中（由 `Config.UseSymlink` 控制）：
1. **IFEO 调试器** — 设置注册表 `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe` 的 debugger 键值为 `rundll32 "core.dll", #6000`，这会调用 `_BootstrapEntry` 以挂起方式创建进程，注入 DLL，然后恢复运行。
2. **符号链接** — 将 `version.dll`（代理 DLL）放入 League 目录。由于 `version.dll` 是已知的系统依赖，它会被自动加载到进程中。

### Core DLL (`core/`) — C++20，CEF C API

DLL 通过可执行文件名判断自己被加载到哪个进程中：
- **浏览器进程** (`LeagueClientUx.exe`)：Hook `cef_initialize`、`cef_browser_host_create_browser`、`cef_request_context_create_context`。注册自定义 scheme 处理器（`https://plugins/` 和 `https://riotclient/`），注入 CEF 命令行优化标志，处理窗口主题/毛玻璃效果的 IPC 消息。
- **渲染进程** (`LeagueClientUxRender.exe`)：Hook `cef_execute_process`。在主框架上下文创建时，在 V8 中暴露 `window.Pengu`、`window.__native`、`window.os`，然后执行预加载脚本。

关键文件：
- `core/src/pengu.h` — 自定义 CEF CAPI 绑定层，将 C 函数指针包装为 C++ 方法（`cef_bind_method`），提供引用计数基类（`CefRefCount<T>`）、字符串辅助类，以及所有平台/工具命名空间
- `core/src/dllmain.cc` — DLL 入口点、进程检测、通过 Hook `CreateProcessW` 向渲染进程注入
- `core/src/browser/browser.cc` — 浏览器进程 Hook
- `core/src/browser/assets.cc` — `https://plugins/` scheme 处理器：提供插件文件服务，自动将 CSS/JSON/资源导入包装为 JS 模块
- `core/src/browser/riotclient.cc` — `https://riotclient/` scheme 处理器：带认证地代理请求到 Riot Client API
- `core/src/renderer/renderer.cc` — 渲染进程 Hook、V8 上下文初始化、插件枚举、预加载脚本执行
- `core/src/config.cc` — 从 loader 目录读取 `config` 键值对配置文件
- `core/src/hook.h` — 内联 Hook 工具，用于拦截 libcef 函数
- `core/src/dllproxy.cc` — 转发 d3d9.dll、dwrite.dll、version.dll 的导出函数（当 core.dll 被重命名为 version.dll 用于符号链接注入时使用）
- `core/cef/` — CEF C API 头文件的 git 子模块（分支 `5359`）

### Loader (`loader/`) — C# .NET 4.7.2 WPF

负责管理安装和插件的 GUI：
- `Program.cs` — 入口点，CLI 参数（`--install`/`--uninstall`），单实例互斥锁
- `Main/Module.cs` — 通过 IFEO 或符号链接安装/卸载 core.dll
- `Main/Plugins.cs` — 扫描 `plugins/` 目录，解析 `@author`/`@link` JSDoc 标签，通过重命名 `.js` ↔ `.js_` 来切换启用/禁用
- `Main/LCU.cs` — 通过 lockfile 凭据或进程命令行解析与 LCU API 通信
- `Main/Updater.cs` — 检查 GitHub Releases API，下载并应用更新
- `Main/Config.cs` — 读写 `config` 键值对文件
- `Main/DataStore.cs` — 对 `datastore` 文件进行异或解密，用于调试
- `App.xaml` — ModernWpfUI 主题，强调色 `#00a1ff`，通过合并 ResourceDictionary 实现多语言

### Plugins (`plugins/`) — TypeScript、SolidJS、Vite

- `src/preload/` — 注入到 LoL 客户端中的脚本。设置 `window.Pengu.version`，暴露原生 API 包装器。
- `src/views/` — SolidJS 应用，提供客户端内插件浏览界面（带搜索的 CommandBar）。
- `vite.config.ts` — 将预加载脚本构建为 IIFE 格式，构建后生成 `dist/preload.g.h`（包含脚本字节的 C 头文件），用于嵌入 core.dll 的 Release 构建。在 Debug 模式下，`renderer.cc` 改为从磁盘读取 `dist/preload.js`。

## 配置文件格式

简单的 `key=value` 键值对。主要选项：
- `LeaguePath` — 英雄联盟安装目录路径
- `UseSymlink` — `true` 使用符号链接注入，`false` 使用 IFEO
- `Language` — 界面语言（如 `English`、`日本語`）
- `OptimizeClient` — 启用 CEF 性能优化标志
- `SuperLowSpecMode` — 为低配机器启用额外的 CEF 性能缩减标志
- `plugins_dir` — 自定义插件目录路径

## 插件系统

插件存放在 `plugins/`（或配置的路径中）：
- 顶级文件：`plugins/插件名.js`
- 子文件夹：`plugins/插件名/index.js`
- 按作者分组：`plugins/@作者名/插件名/index.js`
- 重命名为 `.js_` 可禁用插件；使用 `@author` 和 `@link` JSDoc 标签标注元数据

### 插件生命周期

插件导出两个入口函数：
- `init({ rcp, socket, meta? })` — 插件加载后立即调用，可异步
- `load()` / `default()` — 在 `window.load` 事件时调用

加载顺序见 `plugins/src/preload/loader.ts`，所有插件通过 `import()` 并行加载。

### 插件 API 一览

C++ 层通过 V8 在 `window` 上暴露以下对象：

**`window.Pengu`**（只读，由 C++ 在预加载脚本执行前注入）：
- `Pengu.version` — 加载器版本号
- `Pengu.plugins` — 已扫描到的插件入口路径数组
- `Pengu.isMac` — 是否为 macOS
- `Pengu.superPotato` — 是否开启了超低配模式

**`window.__native`**（原生函数，仅在预加载脚本中使用，随后被删除）：
- `OpenDevTools()`、`OpenPluginsFolder()`、`ReloadClient()`
- `SetWindowTheme()`、`SetWindowVibrancy()`
- `LoadDataStore()`、`SaveDataStore()`

**预加载脚本包装的 API**（供插件直接调用）：
- `window.openDevTools()` — 打开 Chrome DevTools
- `window.openPluginsFolder(path?)` — 在资源管理器中打开插件目录
- `window.reloadClient()` — 重载整个客户端
- `window.restartClient()` — 通过 Riot Client API 重启 UX 进程
- `window.getScriptPath()` — 获取当前脚本路径
- `window.DataStore` — 持久化键值存储，`has(key)` / `get(key, fallback?)` / `set(key, value)` / `remove(key)`
- `window.Effect` — 窗口视觉效果，`apply(name, options)` / `clear()` / `setTheme(theme)`
- `window.rcp` — Riot Client Plugin 钩子系统：
  - `rcp.preInit(name, callback)` — 在插件初始化前拦截
  - `rcp.postInit(name, callback)` — 在插件初始化后获取其 API
  - `rcp.whenReady(name|names[])` — 等待一个或多个插件就绪
  - `rcp.get(name)` — 同步获取已就绪插件的 API
- `window.socket` — LCU WebSocket 事件订阅：
  - `socket.observe(api, listener)` — 订阅 LCU API 事件（如 `"/lol-summoner/v1/current-summoner"` 或 `"all"`）
  - `socket.disconnect(api, listener)` — 取消订阅

## 多语言

WPF 启动器支持 10 种语言，通过 `loader/Languages/` 下的 XAML ResourceDictionary 文件实现：
`de-DE`、`en-US`、`es-ES`、`fr-FR`、`ja-JP`、`pt-BR`、`ru-RU`、`tr-TR`、`vi-VN`、`zh-CN`。

语言由 `config` 文件中的 `Language` 键控制。

## 测试

本项目没有自动化测试（无 unit test、e2e test 等）。

## CI

手动触发的工作流（`.github/workflows/build.yml`）：
- `release: false` — 仅构建，上传构建产物
- `release: true` — 同时执行 SignPath 代码签名和 Inno Setup 安装包制作
