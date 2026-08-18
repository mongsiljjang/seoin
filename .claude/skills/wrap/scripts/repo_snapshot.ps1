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

  $branch = (& git -C $RepoPath branch --show-current 2>$null)
  $head = (& git -C $RepoPath rev-parse --short HEAD 2>$null)
  $status = @(& git -C $RepoPath status --short 2>$null)
  $recent = @(& git -C $RepoPath log -3 --pretty=format:'%h %s' 2>$null)

  [pscustomobject]@{
    path = $RepoPath
    branch = $branch
    head = $head
    clean = ($status.Count -eq 0)
    status = $status
    recent_commits = $recent
  }
}

$repositoryPaths = [System.Collections.Generic.List[string]]::new()
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
    Add-RepositoryPath -RepoPath $candidate.path
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
  repositories = $repositories
} | ConvertTo-Json -Depth 6
