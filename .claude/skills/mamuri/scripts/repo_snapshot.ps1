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

function Get-RepoSnapshot {
  param([string]$RepoPath)

  $ok = $true
  $errorText = ''

  $branch = (& git -C $RepoPath branch --show-current 2>$null)

  $head = (& git -C $RepoPath rev-parse --short HEAD 2>&1)
  if ($LASTEXITCODE -ne 0) { $ok = $false; $errorText = "$head"; $head = '' }

  $status = @(& git -C $RepoPath status --short 2>&1)
  if ($LASTEXITCODE -ne 0) { $ok = $false; $errorText = ($status -join ' '); $status = @() }

  $recent = @(& git -C $RepoPath log -3 --pretty=format:'%h %s' 2>$null)

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
  }
}

# A directory holding a .git entry is only a repository if git agrees it is the
# root. Otherwise git silently answers for the PARENT repository, and a corrupt
# or half-copied .git gets reported as a healthy repo carrying someone else's state.
function Test-RepoRoot {
  param([string]$CandidatePath)

  $top = (& git -C $CandidatePath rev-parse --show-toplevel 2>$null)
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

$root = (& git -C $resolvedProject rev-parse --show-toplevel 2>$null)

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
