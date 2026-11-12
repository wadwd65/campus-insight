param([ValidateSet('Start','Install','Build','CheckRuntime')][string]$Action='Start')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$taskRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRuntime=Join-Path $taskRoot '.campus-runtime'
$taskVersion='24.21.0'
$taskArchiveName='node-v24.21.0-win-x64.zip'
# Pinned against https://nodejs.org/dist/v24.21.0/SHASUMS256.txt
$taskArchiveSha='158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
function Test-CampusNode([string]$Executable) {
  if(-not (Test-Path -LiteralPath $Executable -PathType Leaf)){return $false}
  try { $taskFound=(& $Executable --version 2>$null).Trim(); return ($LASTEXITCODE -eq 0 -and [version]($taskFound.TrimStart('v')) -ge [version]$taskVersion) } catch {return $false}
}
function Get-CampusArchiveSha256([string]$Archive) {
  # Do not rely on Get-FileHash: Windows PowerShell can inherit a Core-only
  # module search path when launched from an IDE or a PowerShell 7 terminal.
  $taskStream=$null
  $taskHasher=$null
  try {
    $taskStream=[IO.File]::OpenRead($Archive)
    $taskHasher=[Security.Cryptography.SHA256]::Create()
    return [BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-','').ToLowerInvariant()
  } finally {
    if($null -ne $taskHasher){$taskHasher.Dispose()}
    if($null -ne $taskStream){$taskStream.Dispose()}
  }
}
function Expand-CampusArchive([string]$Archive,[string]$Destination) {
  # Use the Windows .NET ZIP implementation instead of optional PS modules.
  [void][Reflection.Assembly]::LoadWithPartialName('System.IO.Compression')
  [void][Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem')
  [void][Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.ZipFile')
  $taskZipRoot=[IO.Path]::GetFullPath($Destination).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
  $taskZip=[IO.Compression.ZipFile]::OpenRead($Archive)
  try {
    foreach($taskEntry in $taskZip.Entries){
      $taskEntryName=$taskEntry.FullName.Replace('/',[IO.Path]::DirectorySeparatorChar)
      if([IO.Path]::IsPathRooted($taskEntryName)){throw '运行工具压缩包包含无效路径。'}
      $taskEntryPath=[IO.Path]::GetFullPath([IO.Path]::Combine($Destination,$taskEntryName))
      if(-not $taskEntryPath.StartsWith($taskZipRoot,[StringComparison]::OrdinalIgnoreCase)){throw '运行工具压缩包路径超出解压目录，已停止。'}
    }
  } finally {$taskZip.Dispose()}
  [IO.Compression.ZipFile]::ExtractToDirectory($Archive,$Destination)
}
try {
  if(-not (Test-Path -LiteralPath (Join-Path $taskRoot 'dist\index.html'))){throw '缺少完整网页。请先全部解压；源码仓库应包含 dist 目录。'}
  $taskNode=$null
  foreach($taskCandidate in @((Join-Path $taskRoot 'runtime\node.exe'),(Join-Path $taskRuntime 'node.exe'))) {
    if((Test-CampusNode $taskCandidate) -and ($Action -ne 'Build' -or (Test-Path -LiteralPath (Join-Path (Split-Path $taskCandidate -Parent) 'npm.cmd')))){$taskNode=$taskCandidate;break}
  }
  # A source checkout can start immediately with an already installed supported Node.
  # Installation uses a licensed portable runtime rather than depending on system PATH.
  if(-not $taskNode -and $Action -in @('Start','Build')){
    $taskInstalled=Get-Command node.exe -ErrorAction SilentlyContinue
    if($taskInstalled -and (Test-CampusNode $taskInstalled.Source) -and ($Action -ne 'Build' -or (Test-Path -LiteralPath (Join-Path (Split-Path $taskInstalled.Source -Parent) 'npm.cmd')))){$taskNode=$taskInstalled.Source}
  }
  if(-not $taskNode){
    if(-not [Environment]::Is64BitOperatingSystem){throw '自动运行入口适用于 Windows x64。其他系统请按 README 的 Node.js 路线启动。'}
    Write-Host '第一次运行：正在准备独立运行工具，不需要管理员权限，也不修改系统设置。'
    New-Item -ItemType Directory -Path $taskRuntime -Force | Out-Null
    $taskDownload=Join-Path $taskRuntime ('download-'+[Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $taskDownload | Out-Null
    $taskArchive=Join-Path $taskDownload $taskArchiveName
    if($env:CAMPUS_NODE_ARCHIVE){
      Copy-Item -LiteralPath $env:CAMPUS_NODE_ARCHIVE -Destination $taskArchive
    } else {
      [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
      $taskFetched=$false
      foreach($taskUrl in @("https://nodejs.org/dist/v$taskVersion/$taskArchiveName","https://npmmirror.com/mirrors/node/v$taskVersion/$taskArchiveName")){
        try{Invoke-WebRequest -UseBasicParsing -Uri $taskUrl -OutFile $taskArchive -TimeoutSec 120;$taskFetched=$true;break}catch{Write-Host '正在尝试备用下载地址…'}
      }
      if(-not $taskFetched){throw '运行工具下载失败。请使用随参赛包提供的 Windows x64 即用包，无需联网下载；也可安装 Node.js 24.21 或更新版本后重试。'}
    }
    if((Get-CampusArchiveSha256 $taskArchive) -ne $taskArchiveSha){throw '下载校验不通过，已停止运行。请重新下载官方运行工具或使用已验证的 Windows 即用包。'}
    Expand-CampusArchive $taskArchive $taskDownload
    $taskExtracted=Join-Path $taskDownload 'node-v24.21.0-win-x64'
    if(-not (Test-CampusNode (Join-Path $taskExtracted 'node.exe'))){throw '运行工具解压后校验失败。'}
    if(-not [IO.File]::ReadAllText((Join-Path $taskExtracted 'LICENSE')).Contains('Node.js is licensed')){throw '运行工具缺少许可证。'}
    Copy-Item -LiteralPath (Join-Path $taskExtracted 'node.exe') -Destination (Join-Path $taskRuntime 'node.exe') -Force
    Copy-Item -LiteralPath (Join-Path $taskExtracted 'LICENSE') -Destination (Join-Path $taskRuntime 'LICENSE') -Force
    # Keep npm with the source checkout, so the rebuild route also works without system Node.
    foreach($taskFile in @('npm.cmd','npm','npx.cmd','npx')){Copy-Item -LiteralPath (Join-Path $taskExtracted $taskFile) -Destination (Join-Path $taskRuntime $taskFile) -Force}
    Copy-Item -LiteralPath (Join-Path $taskExtracted 'node_modules') -Destination $taskRuntime -Recurse -Force
    # Only our freshly created GUID directory is removed. Never delete application/user data.
    $taskResolved=[IO.Path]::GetFullPath($taskDownload)
    if((Split-Path $taskResolved -Parent) -ne $taskRuntime -or (Split-Path $taskResolved -Leaf) -notmatch '^download-[a-f0-9]{32}$'){throw '临时目录校验失败。'}
    try {Remove-Item -LiteralPath $taskResolved -Recurse -Force}
    catch {Write-Host '运行工具已准备完成；临时下载目录暂被占用，已保留，不影响启动。'}
    $taskNode=Join-Path $taskRuntime 'node.exe'
  }
  if($Action -eq 'CheckRuntime'){Write-Host "运行工具已就绪：$taskNode";exit 0}
  if($Action -eq 'Build') {
    $taskNpm=Join-Path (Split-Path $taskNode -Parent) 'npm.cmd'
    $env:PATH=(Split-Path $taskNode -Parent)+';'+$env:PATH
    Push-Location $taskRoot
    try {
      Write-Host '正在从锁定依赖重新构建源码；这一步需要联网，成品启动无需执行。'
      & $taskNpm ci --no-audit --fund=false
      if($LASTEXITCODE -ne 0){throw '依赖下载失败。请检查网络，或先双击“开始使用”体验已提供的成品。'}
      & $taskNpm run build
      if($LASTEXITCODE -ne 0){throw '源码构建没有通过，请保留窗口中的错误信息。'}
      & $taskNpm run verify:dist
      if($LASTEXITCODE -ne 0){throw '构建产物核验没有通过。'}
    } finally {Pop-Location}
  }
  if($Action -eq 'Install') { & $taskNode (Join-Path $PSScriptRoot 'install-windows.mjs') }
  else { & $taskNode (Join-Path $PSScriptRoot 'start-local.mjs') }
  exit $LASTEXITCODE
} catch {
  Write-Host "`n未能完成：$($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
