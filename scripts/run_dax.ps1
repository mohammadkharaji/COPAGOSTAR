param([string]$QueryDir,[string]$OutDir,[string]$Workbook='D:\SR\SR-1405.xlsx')
$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$xl = New-Object -ComObject Excel.Application
$xl.Visible=$false; $xl.DisplayAlerts=$false; $xl.AskToUpdateLinks=$false
$enc = New-Object System.Text.UTF8Encoding($false)
try {
  $wb = $xl.Workbooks.Open($Workbook, 0, $true)
  $conn = $wb.Model.DataModelConnection.ModelConnection.ADOConnection
  foreach($f in Get-ChildItem $QueryDir -Filter *.dax | Sort-Object Name -Descending){
    $target = Join-Path $OutDir ($f.BaseName + '.tsv')
    if(Test-Path $target){ Write-Output ('{0}: skipped (exists)' -f $f.Name); continue }
    $q = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $sw=[Diagnostics.Stopwatch]::StartNew()
    try {
      $rs = $conn.Execute($q)
      $hdr = (0..($rs.Fields.Count-1) | ForEach-Object { $rs.Fields.Item($_).Name }) -join [char]31
      $body = ''
      if(-not $rs.EOF){ $body = $rs.GetString(2, -1, [string][char]31, [string][char]30, '') }
      $tmp = $target + '.part'
      [System.IO.File]::WriteAllText($tmp, $hdr + [char]30 + $body, $enc)
      Move-Item -Force $tmp $target
      $rs.Close()
      Write-Output ("{0}: ok {1}s" -f $f.Name, [int]$sw.Elapsed.TotalSeconds)
    } catch { Write-Output ("{0}: ERROR {1}" -f $f.Name, $_.Exception.Message) }
  }
  $wb.Close($false)
} finally { $xl.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
