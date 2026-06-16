# 胎教故事助手 PWA MVP 当前状态

## 一、当前整体结论

当前版本已经实现了胎教故事助手 MVP 的主要前端闭环：输入主题、生成 mock 故事、预览编辑、保存、选择声音、生成 mock 朗读音频、播放、查看历史，以及录音并保存音色记录。  
故事生成、TTS 合成、声音复刻都还没有接入真实后端服务，当前依赖前端 mock 逻辑即可在无 API Key 的情况下演示完整流程。  
页面结构已经覆盖首页、生成页、声音页、播放页、历史页、设置页，并采用移动端优先的卡片式 PWA 外壳。  
需要注意的是，之前已通过 `npm run lint` 和 `npm run build`，但浏览器自动化验收没有完成；当前用户已在浏览器打开 `http://127.0.0.1:3001/`，仍建议手动完整点一遍主流程。  

## 二、已完成的功能

### 1. 首页

- 已实现：首页展示宝宝昵称、孕周/预产期状态、今日推荐主题、最近播放记录、快捷入口。
- 核心文件/组件：[src/App.tsx](../src/App.tsx) 中的 `HomePage`、主 `App` 状态管理。
- 功能性质：真实前端 UI + 本地数据读取；今日推荐主题为前端静态数组轮换，非真实推荐服务。

### 2. 故事生成

- 已实现：支持输入主题，选择故事长度、故事风格、朗读语气，并点击生成故事。
- 核心文件/组件：[src/App.tsx](../src/App.tsx) 中的 `GeneratePage`、`handleGenerate`；[src/babyStory/api.ts](../src/babyStory/api.ts) 中的 `generateStory`。
- 功能性质：默认是 mock 流程；当 `VITE_USE_REAL_STORY_API === 'true'` 时才会请求 `POST /api/story/generate`。

### 3. 故事预览/编辑

- 已实现：生成后展示标题和正文；标题、正文都可以编辑；支持保存、重新生成、生成朗读。
- 核心文件/组件：[src/App.tsx](../src/App.tsx) 中的 `GeneratePage`、`saveDraft`、`handleSynthesize`。
- 功能性质：真实前端编辑和 localStorage 保存；故事内容来源当前为 mock。

### 4. 声音管理

- 已实现：声音页包含系统声音和我的声音；系统声音内置三种：妈妈的轻声、爸爸的暖声、月光旁白；可选择默认使用的声音。
- 核心文件/组件：[src/App.tsx](../src/App.tsx) 中的 `VoicesPage`；[src/babyStory/storage.ts](../src/babyStory/storage.ts) 中的 `systemVoices`、`loadVoices`、`saveCustomVoices`。
- 功能性质：真实前端选择与本地保存；系统声音只是本地配置，不是真实 TTS 音色。

### 5. 录音采样

- 已实现：使用浏览器 `MediaRecorder` 调用麦克风录制声音样本；支持试听录音；限制保存前需要录制至少 10 秒；录制约 20 秒自动停止。
- 核心文件/组件：[src/App.tsx](../src/App.tsx) 中的 `VoicesPage`、`startRecording`、`stopRecording`、`saveVoice`。
- 功能性质：真实浏览器录音能力 + localStorage 保存样本 Data URL；没有进行真实声音克隆。

### 6. 音频合成/播放器

- 已实现：从故事正文、选择的声音和语气生成 mock 音频；播放页支持播放、暂停、进度条拖动、重新生成音频。
- 核心文件/组件：[src/App.tsx](../src/App.tsx) 中的 `PlayerPage`、`handleSynthesize`；[src/babyStory/api.ts](../src/babyStory/api.ts) 中的 `synthesizeSpeech`、`encodeWav`。
- 功能性质：mock TTS；生成的是前端合成的 WAV 波形，不是真人语音或真实语音合成结果。

### 7. 历史记录

- 已实现：历史页按 `createdAt` 日期倒序展示故事；支持再次播放、编辑、删除。
- 核心文件/组件：[src/App.tsx](../src/App.tsx) 中的 `HistoryPage`、`handleDeleteStory`；[src/babyStory/storage.ts](../src/babyStory/storage.ts) 中的 `loadStories`、`saveStories`。
- 功能性质：真实前端历史和本地持久化；音频记录随故事一起保存。

### 8. 设置页

- 已实现：宝宝昵称、预产期、孕周、默认故事长度、默认风格、默认声音、缓存清理。
- 核心文件/组件：[src/App.tsx](../src/App.tsx) 中的 `SettingsPage`；[src/babyStory/storage.ts](../src/babyStory/storage.ts) 中的 `defaultSettings`、`loadSettings`、`saveSettings`、`clearBabyStoryCache`。
- 功能性质：真实本地设置保存；没有账号、云同步或多设备同步。

### 9. PWA / manifest / service worker

- 已实现：`index.html` 已设置 PWA 基础元信息和 manifest 引用；`public/manifest.webmanifest` 提供应用名、短名、图标、standalone 显示模式；`public/sw.js` 提供基础缓存；`src/main.tsx` 在生产环境注册 service worker。
- 核心文件：[index.html](../index.html)、[public/manifest.webmanifest](../public/manifest.webmanifest)、[public/pwa-icon.svg](../public/pwa-icon.svg)、[public/sw.js](../public/sw.js)、[src/main.tsx](../src/main.tsx)。
- 功能性质：真实 PWA 基础能力；没有安装提示 UI、缓存升级提示、离线状态提示。

### 10. 本地存储

- 已实现：设置、故事记录、自定义音色记录都保存到 localStorage；故事记录内可以包含 mock 音频 Data URL。
- 核心文件：[src/babyStory/storage.ts](../src/babyStory/storage.ts)。
- 功能性质：真实 localStorage 持久化；还没有 IndexedDB，音频多时可能超过 localStorage 容量。

### 11. API 预留

- 已实现：API 层预留三个后端代理入口：
  - `POST /api/story/generate`
  - `POST /api/tts/synthesize`
  - `POST /api/voice/clone`
- 核心文件：[src/babyStory/api.ts](../src/babyStory/api.ts)。
- 功能性质：接口调用位置已预留，但默认不启用；没有真实后端实现，也没有服务商配置或 API Key。

## 三、当前使用的 mock 逻辑

- 故事生成没有接入真实 AI。默认情况下，`generateStory` 根据主题、长度、风格和语气，从本地模板和场景词中拼出胎教故事。
- TTS 没有接入真实语音合成。默认情况下，`synthesizeSpeech` 在浏览器中生成一段 WAV 波形音频。
- 声音复刻没有接入真实服务。`cloneVoice` 只预留了 `POST /api/voice/clone` 调用；当前录音样本只是保存为本地音色记录。
- 当前 mock 音频的生成方式：前端创建 `Float32Array` 采样数据，根据声音类型和语气调整基础频率，用正弦波与包络生成音频采样，再通过 `encodeWav` 编码为 WAV Blob，最后转成 Data URL 给 `<audio>` 播放。
- 没有 API Key 的情况下仍可演示：
  - 输入主题并生成故事
  - 编辑标题和正文
  - 保存故事
  - 选择系统声音
  - 生成 mock 朗读音频
  - 播放、暂停、拖动进度
  - 保存历史和再次播放
  - 浏览器录音、试听并保存音色记录
  - 修改宝宝信息和默认偏好

## 四、当前未完成/待完善内容

### P0：影响核心流程运行的问题

- 浏览器实际验证尚未完整完成：之前已通过 `npm run lint` 和 `npm run build`，但自动化浏览器验收受沙箱权限和 Playwright 依赖问题影响未完成。当前需要在 `http://127.0.0.1:3001/` 手动点完整闭环。
- 当前开发服务器端口可能不是固定 3000：如果 3000 被占用，Vite 会切到 3001 或其他端口，需要以终端输出为准。

### P1：影响体验但不阻塞演示的问题

- 真实 AI 故事生成接口未接入：现在故事内容是模板 mock，不具备真实大模型生成能力。
- 通义百炼 TTS 未接入：当前音频只是正弦波 mock，不是自然朗读。
- 通义百炼 voice clone 或其他声音复刻服务未接入：当前只保存录音样本，不生成真实可复用克隆音色。
- localStorage 保存音频 Data URL 有容量风险：故事和 mock 音频多了以后可能写入失败，后续应迁移 IndexedDB。
- PWA 体验仍基础：没有安装引导、离线状态提示、缓存升级提示、更新确认。
- UI 仍需要真实手机尺寸和 iOS Safari 检查：当前主要按移动端布局实现，但未做系统化多设备截图验收。
- 录音权限失败时只有基础错误提示，没有更细的浏览器权限指引。

### P2：后续增强项

- 原油耗 App 目前保留为 [src/FuelApp.tsx](../src/FuelApp.tsx)，但没有路由或入口可以在两个 App 之间切换访问。
- 故事安全过滤目前依赖 prompt/mock 设计，没有独立敏感内容过滤器。
- 历史记录没有搜索、筛选、按月份分组或批量导出。
- 声音样本没有波形展示、重命名、删除和授权说明确认弹窗。
- 设置页没有“恢复默认设置”和“导入/导出本地数据”。
- service worker 缓存策略较粗，未按静态资源版本精细控制。

## 五、如何本地验证

1. 启动项目：

   ```bash
   cd D:\Codex\油耗监控
   npm run dev -- --host 127.0.0.1
   ```

2. 打开地址：

   - 优先看终端输出的 Vite 地址。
   - 常见地址是 `http://127.0.0.1:3000/`。
   - 如果 3000 被占用，可能是 `http://127.0.0.1:3001/`，当前用户浏览器已打开这个地址。

3. 验证顺序：

   - 首页：应看到胎教故事助手标题、宝宝信息、今日推荐主题、快捷入口和最近播放区域。
   - 点击“生成今日故事”或底部“生成”：输入主题，选择长度、风格、语气。
   - 点击“生成胎教故事”：应出现 loading，随后出现预览与编辑区域。
   - 编辑标题或正文，点击“保存”：故事应写入本地历史。
   - 点击“朗读”：应生成 mock 音频并跳转到播放页。
   - 播放页：点击播放按钮应开始播放；再次点击暂停；拖动进度条应改变播放位置；点击重新生成可再次生成 mock 音频。
   - 历史页：应看到刚才保存的故事；点击播放回到播放器；点击编辑回到生成页；点击删除可删除记录。
   - 声音页：选择系统声音；点击录制 10-20 秒，授权麦克风后录音，停止后应出现可试听 audio 控件，保存后自定义音色应出现在声音列表。
   - 设置页：修改宝宝昵称、预产期/孕周、默认长度、默认风格、默认声音，刷新后应保留；点击清理缓存会清空故事和自定义音色。

4. 每一步预期结果：

   - 生成故事不需要 API Key。
   - 生成朗读不需要 API Key。
   - 播放器使用浏览器 `<audio>` 播放 Data URL。
   - 历史和设置刷新后仍存在，因为保存在 localStorage。

5. 如果失败，可能原因：

   - 页面打不开：Vite 没启动，或端口不是 3001。
   - 生成失败：查看浏览器控制台是否有运行时错误。
   - 录音失败：浏览器未授予麦克风权限，或当前环境不支持 `MediaRecorder`。
   - 保存失败：localStorage 被禁用、隐私模式限制，或音频 Data URL 太大导致容量不足。
   - PWA 不生效：service worker 只在生产构建中注册，开发环境不会注册。

## 六、代码结构说明

- [src/App.tsx](../src/App.tsx)：胎教故事助手主入口和主要页面组件所在地。包含主状态管理、底部导航、首页、生成页、声音页、播放器、历史页、设置页，以及保存、生成、合成、删除等页面级动作。
- [src/FuelApp.tsx](../src/FuelApp.tsx)：原油耗 Web App 的备份入口。当前没有挂载到主入口，主要用于保留原业务代码。
- [src/babyStory/types.ts](../src/babyStory/types.ts)：胎教助手的数据类型定义，包括故事长度、风格、语气、宝宝设置、故事草稿、声音档案、音频记录和 API 输入类型。
- [src/babyStory/storage.ts](../src/babyStory/storage.ts)：本地存储层。封装 localStorage 的读取、保存、清理；定义默认设置和系统声音。
- [src/babyStory/api.ts](../src/babyStory/api.ts)：API 和 mock 逻辑层。封装故事生成、TTS 合成、声音克隆预留调用；默认走 mock，环境变量开启后可请求后端代理。
- [src/main.tsx](../src/main.tsx)：React 挂载入口；生产环境注册 service worker。
- [src/vite-env.d.ts](../src/vite-env.d.ts)：补充 Vite 类型声明，使 `import.meta.env` 在 TypeScript 检查中可用。
- [index.html](../index.html)：PWA 页面基础元信息、移动端 viewport、manifest 引用、字体引用和根节点。
- [public/manifest.webmanifest](../public/manifest.webmanifest)：PWA manifest，定义应用名、短名、图标、主题色和 standalone 显示。
- [public/pwa-icon.svg](../public/pwa-icon.svg)：PWA 图标。
- [public/sw.js](../public/sw.js)：基础 service worker，安装时缓存入口、manifest 和图标；fetch 失败时尝试从缓存回退。
- [src/index.css](../src/index.css)：沿用项目全局 Tailwind 和大量原油耗 App 样式。胎教助手主要使用 Tailwind class，没有新增独立 CSS 文件。

## 七、下一步建议

1. 完成一次手动浏览器验收，记录在真实 Chrome、Edge、iOS Safari 中是否存在 UI、录音、播放问题。
2. 增加后端代理服务，先接入真实 `POST /api/story/generate`，确保 API Key 只在后端环境变量中保存。
3. 接入通义百炼或目标服务商 TTS，将 `POST /api/tts/synthesize` 返回真实音频 URL 或 Blob。
4. 接入声音复刻服务前，先完善授权确认流程和样本管理，再接 `POST /api/voice/clone`。
5. 将故事、音色样本、音频记录从 localStorage 迁移到 IndexedDB，localStorage 只保存轻量设置。
6. 完善 PWA 安装体验：安装提示、离线状态提示、缓存更新提示、版本号展示。
7. 精修移动端 UI：检查小屏按钮文字、textarea 高度、底部导航遮挡、iOS 安全区和键盘弹起表现。
8. 如果需要保留油耗 App 可访问，增加路由或应用选择页，而不是只保留 `FuelApp.tsx` 文件。

## 八、风险与注意事项

- API Key 暴露风险：当前前端没有写死密钥，这是正确状态；后续真实接入必须通过后端代理，不能把百炼或其他服务商 Key 写进 Vite 前端环境变量。
- 音频文件存储容量风险：当前 mock 音频和录音样本都可能以 Data URL 存入 localStorage，数据量一大容易超过浏览器配额，应尽快迁移 IndexedDB。
- 浏览器录音权限问题：`MediaRecorder` 依赖 HTTPS 或 localhost、安全上下文、用户授权和浏览器支持；iOS Safari 兼容性尤其需要实机验证。
- iOS PWA 兼容问题：iOS 对后台音频、service worker、缓存、安装入口、麦克风权限都有差异，不能只按桌面 Chrome 结果判断。
- 声音采样授权合规问题：页面已有“只能采样本人或已获授权家人声音”的提示，但后续真实 voice clone 前应增加显式勾选确认、样本删除、授权记录和禁止复刻陌生人/明星/主播的更强约束。
- 内容安全风险：当前 mock 故事不会主动生成高风险内容；真实 AI 接入后需要服务端 prompt、审核和敏感内容过滤，避免恐怖、打斗、焦虑、疾病、死亡、离别等不适合胎教的内容。

一句话结论：现在这个版本可以作为“无 API Key 的 MVP 演示版”，能跑通前端闭环，但还不是接入真实 AI/TTS/声音复刻服务的生产版本。
