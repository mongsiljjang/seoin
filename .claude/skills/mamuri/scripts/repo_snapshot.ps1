param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectPath,

  [ValidateRange(0, 8)]
  [int]$MaxDepth = 3
)

$resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path
$excludedDirectoryNames = @(
  '.git',
  '.cache',
  '.next',
  '.venv',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
  'venv'
)

# 기준은 원격(GitHub 등)이다. 이 경로는 이 PC 에 받아 둔 복사본일 뿐이라, 로컬이 원격과 얼마나 갈라졌는지도 같이 낸다.
function Get-RepoSnapshot {
  param([string]$RepoPath)

  $ok = $true
  $errorText = ''

  $branch = (& git -c "safe.directory=$($RepoPath -replace '\\','/')" -C $RepoPath branch --show-current 2>$null)

  $head = (& git -c "safe.directory=$($RepoPath -replace '\\','/')" -C $RepoPath rev-parse --short HEAD 2>&1)
  if ($LASTEXITCODE -ne 0) { $ok = $false; $errorText = "$head"; $head = '' }

  $status = @(& git -c "safe.directory=$($RepoPath -replace '\\','/')" -C $RepoPath status --short 2>&1)
  if ($LASTEXITCODE -ne 0) { $ok = $false; $errorText = ($status -join ' '); $status = @() }
  $status = @($status | Where-Object { "$_" -notmatch '^(warning|hint):' })
  if ($head -is [array]) { $head = @($head | Where-Object { "$_" -notmatch '^(warning|hint):' })[-1] }

  $recent = @(& git -c "safe.directory=$($RepoPath -replace '\\','/')" -C $RepoPath log -3 --pretty=format:'%h %s' 2>$null)

  $remoteUrl = (& git -c "safe.directory=$($RepoPath -replace '\\','/')" -C $RepoPath remote get-url origin 2>$null)
  $upstream = (& git -c "safe.directory=$($RepoPath -replace '\\','/')" -C $RepoPath rev-parse --abbrev-ref '@{u}' 2>$null)
  $ahead = $null; $behind = $null
  if ($LASTEXITCODE -eq 0 -and $upstream) {
    $lr = (& git -c "safe.directory=$($RepoPath -replace '\\','/')" -C $RepoPath rev-list --left-right --count 'HEAD...@{u}' 2>$null)
    if ($lr -match '^(\d+)\s+(\d+)$') { $ahead = [int]$Matches[1]; $behind = [int]$Matches[2] }
  }

  [pscustomobject]@{
    path = $RepoPath
    branch = $branch
    head = $head
    ok = $ok
    error = $errorText
    # A repository git could not read is NOT clean -- it is unknown.
    clean = ($ok -and $status.Count -eq 0)
    status = $status
    recent_commits = $recent
    remote = $remoteUrl
    upstream = $upstream
    # 마지막 fetch 기준이다. 푸시 여부를 말하려면 먼저 git fetch 를 한다. null 은 upstream 이 없다는 뜻.
    ahead_of_remote = $ahead
    behind_remote = $behind
  }
}

# A directory holding a .git entry is only a repository if git agrees it is the
# root. Otherwise git silently answers for the PARENT repository, and a corrupt
# or half-copied .git gets reported as a healthy repo carrying someone else's state.
function Test-RepoRoot {
  param([string]$CandidatePath)

  $top = (& git -c "safe.directory=$($CandidatePath -replace '\\','/')" -C $CandidatePath rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $top) { return $false }
  try {
    $topResolved = (Resolve-Path -LiteralPath $top -ErrorAction Stop).Path
    $candidateResolved = (Resolve-Path -LiteralPath $CandidatePath -ErrorAction Stop).Path
  } catch { return $false }
  return ($topResolved.TrimEnd('\','/') -ieq $candidateResolved.TrimEnd('\','/'))
}

$repositoryPaths = [System.Collections.Generic.List[string]]::new()
$unreadableGitDirs = [System.Collections.Generic.List[string]]::new()
$seenRepositoryPaths = [System.Collections.Generic.HashSet[string]]::new(
  [System.StringComparer]::OrdinalIgnoreCase
)

function Add-RepositoryPath {
  param([string]$RepoPath)

  $resolvedRepo = (Resolve-Path -LiteralPath $RepoPath).Path
  if ($seenRepositoryPaths.Add($resolvedRepo)) {
    $repositoryPaths.Add($resolvedRepo)
  }
}

$root = (& git -c "safe.directory=$($resolvedProject -replace '\\','/')" -C $resolvedProject rev-parse --show-toplevel 2>$null)

if ($LASTEXITCODE -eq 0 -and $root) {
  Add-RepositoryPath -RepoPath $root
}

$queue = [System.Collections.Queue]::new()

if ($MaxDepth -gt 0) {
  Get-ChildItem -LiteralPath $resolvedProject -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object { $excludedDirectoryNames -notcontains $_.Name } |
    ForEach-Object {
      $queue.Enqueue([pscustomobject]@{ path = $_.FullName; depth = 1 })
    }
}

while ($queue.Count -gt 0) {
  $candidate = $queue.Dequeue()
  $gitMarker = Join-Path $candidate.path '.git'

  if (Test-Path -LiteralPath $gitMarker) {
    if (Test-RepoRoot -CandidatePath $candidate.path) {
      Add-RepositoryPath -RepoPath $candidate.path
    } else {
      $unreadableGitDirs.Add($candidate.path)
    }
    continue
  }

  if ($candidate.depth -ge $MaxDepth) {
    continue
  }

  Get-ChildItem -LiteralPath $candidate.path -Directory -Force -ErrorAction SilentlyContinue |
    Where-Object { $excludedDirectoryNames -notcontains $_.Name } |
    ForEach-Object {
      $queue.Enqueue([pscustomobject]@{
        path = $_.FullName
        depth = $candidate.depth + 1
      })
    }
}

$repositories = @(
  $repositoryPaths |
    Sort-Object |
    ForEach-Object { Get-RepoSnapshot -RepoPath $_ }
)

[pscustomobject]@{
  project = $resolvedProject
  captured_at = (Get-Date).ToString('o')
  discovery_max_depth = $MaxDepth
  repository_count = $repositories.Count
  unreadable_git_dirs = @($unreadableGitDirs)
  repositories = $repositories
} | ConvertTo-Json -Depth 6
