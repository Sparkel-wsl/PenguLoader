# Pengu Loader 构建指南

## 修改了 plugins/（前端 JS/UI）

```bash
cd plugins && pnpm build
```

然后重新编译 core.dll（预加载脚本嵌入 DLL）：

```powershell
powershell -Command "& 'C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\Launch-VsDevShell.ps1' -Arch amd64; cd D:\dev\PenguLoader; msbuild core/core.vcxproj -t:Build -p:Configuration=Release -p:Platform=x64"
```

最后复制产物：

```bash
cp core/bin/core.dll bin/core.dll
```

## 修改了 loader/（WPF 启动器）

```bash
dotnet build loader/loader.csproj -c Release -p:Platform="Any CPU"
```

## 完整构建（改什么都行）

```powershell
# 1. JS 预加载
cd D:\dev\PenguLoader\plugins && pnpm build && cd ..

# 2. C++ DLL
powershell -Command "& 'C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\Launch-VsDevShell.ps1' -Arch amd64; cd D:\dev\PenguLoader; msbuild pengu.sln -t:Build -p:Configuration=Release -p:Platform=x64"

# 3. WPF 启动器
dotnet build loader/loader.csproj -c Release -p:Platform="Any CPU"
```

> **注意**：首次构建前需要 `cd plugins && pnpm install` 安装依赖，以及 `git submodule update --init` 拉取 CEF 头文件。
>
> 如果要在 VS 2022 IDE 里构建，直接打开 `pengu.sln` 点生成即可，无需手动敲命令。
