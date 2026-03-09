[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Test-TrackedTextFile {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path
  )

  $leaf = Split-Path -Leaf $Path
  $extension = [System.IO.Path]::GetExtension($leaf).ToLowerInvariant()

  if ($leaf -in @('.gitignore', '.claspignore')) {
    return $true
  }

  return $extension -in @(
    '.gs',
    '.html',
    '.json',
    '.md',
    '.ps1',
    '.txt',
    '.yaml',
    '.yml'
  )
}

function Add-Failure {
  param(
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[string]] $Failures,
    [Parameter(Mandatory = $true)]
    [string] $Message
  )

  $Failures.Add($Message) | Out-Null
}

function Add-RegexFailures {
  param(
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[string]] $Failures,
    [Parameter(Mandatory = $true)]
    [string] $RelativePath,
    [Parameter(Mandatory = $true)]
    [string] $Content,
    [Parameter(Mandatory = $true)]
    [hashtable[]] $Rules
  )

  foreach ($rule in $Rules) {
    foreach ($match in [regex]::Matches($Content, $rule.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
      $snippet = $match.Value.Trim()
      if ($snippet.Length -gt 140) {
        $snippet = $snippet.Substring(0, 140) + '...'
      }

      Add-Failure -Failures $Failures -Message "${RelativePath}: $($rule.Message) [$snippet]"
    }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$policyPath = Join-Path $repoRoot 'docs/repository-sanitization.md'

if (-not (Test-Path $policyPath -PathType Leaf)) {
  throw "Missing policy file: docs/repository-sanitization.md"
}

Push-Location $repoRoot

try {
  $trackedFiles = @(git ls-files)
  if ($LASTEXITCODE -ne 0) {
    throw 'git ls-files failed'
  }

  $trackedFiles = $trackedFiles | Where-Object { $_ }
  $failures = [System.Collections.Generic.List[string]]::new()

  if ($trackedFiles -contains '.clasp.json') {
    Add-Failure -Failures $failures -Message "Tracked .clasp.json detected. Keep the live binding local and use .clasp.example.json only as the public template."
  }

  $claspExamplePath = Join-Path $repoRoot '.clasp.example.json'
  if (-not (Test-Path $claspExamplePath -PathType Leaf)) {
    Add-Failure -Failures $failures -Message 'Missing .clasp.example.json template.'
  }
  else {
    try {
      $claspExample = Get-Content -Raw $claspExamplePath | ConvertFrom-Json
    }
    catch {
      Add-Failure -Failures $failures -Message ".clasp.example.json is not valid JSON: $($_.Exception.Message)"
      $claspExample = $null
    }

    if ($null -ne $claspExample) {
      if ($claspExample.scriptId -ne 'YOUR_SCRIPT_ID') {
        Add-Failure -Failures $failures -Message ".clasp.example.json must keep scriptId placeholder YOUR_SCRIPT_ID, found '$($claspExample.scriptId)'."
      }

      if ($claspExample.parentId -ne 'YOUR_SPREADSHEET_ID') {
        Add-Failure -Failures $failures -Message ".clasp.example.json must keep parentId placeholder YOUR_SPREADSHEET_ID, found '$($claspExample.parentId)'."
      }
    }
  }

  $leakRules = @(
    @{
      Message = 'Found a live Drive folder URL'
      Pattern = 'https://drive\.google\.com/drive/folders/[A-Za-z0-9_-]{20,}'
    },
    @{
      Message = 'Found a live Spreadsheet URL'
      Pattern = 'https://docs\.google\.com/spreadsheets/d/[A-Za-z0-9_-]{20,}'
    },
    @{
      Message = 'Found a live Apps Script deployment or project URL'
      Pattern = 'https://script\.google\.com/(?:macros/s|home/projects)/[A-Za-z0-9_-]{20,}'
    },
    @{
      Message = 'Found a Telegram bot token'
      Pattern = '\b\d{8,10}:[A-Za-z0-9_-]{20,}\b'
    },
    @{
      Message = 'Found a non-placeholder scriptId in tracked text'
      Pattern = '"scriptId"\s*:\s*"(?!YOUR_SCRIPT_ID")[A-Za-z0-9_-]{20,}"'
    },
    @{
      Message = 'Found a non-placeholder parentId in tracked text'
      Pattern = '"parentId"\s*:\s*"(?!YOUR_SPREADSHEET_ID")[A-Za-z0-9_-]{20,}"'
    },
    @{
      Message = 'Found a live folder-id assignment'
      Pattern = '\b(?:ROOT_FOLDER_ID|TG_[A-Z_]+_FOLDER_ID)\b\s*[:=]\s*["'']?(?!YOUR_)[A-Za-z0-9_-]{20,}["'']?'
    },
    @{
      Message = 'Found a live TELEGRAM_BOT_TOKEN assignment'
      Pattern = '\bTELEGRAM_BOT_TOKEN\b\s*[:=]\s*["'']?\d{8,10}:[A-Za-z0-9_-]{20,}["'']?'
    }
  )

  foreach ($relativePath in $trackedFiles) {
    if (-not (Test-TrackedTextFile -Path $relativePath)) {
      continue
    }

    $fullPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path $fullPath -PathType Leaf)) {
      continue
    }

    $content = Get-Content -Raw $fullPath
    Add-RegexFailures -Failures $failures -RelativePath $relativePath -Content $content -Rules $leakRules
  }

  if ($failures.Count -gt 0) {
    $lines = @(
      'Public surface audit failed.',
      'Policy: docs/repository-sanitization.md'
    ) + ($failures | ForEach-Object { "- $_" })

    throw ($lines -join [Environment]::NewLine)
  }

  Write-Host 'Public surface audit passed.'
  Write-Host 'Policy: docs/repository-sanitization.md'
}
finally {
  Pop-Location
}
