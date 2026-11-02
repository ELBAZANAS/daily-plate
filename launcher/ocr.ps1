param(
  [Parameter(Mandatory = $true)][string]$Path
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($WinRtTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]

function Read-Bitmap($ImagePath) {
  $full = (Resolve-Path -LiteralPath $ImagePath).Path
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
}

function Read-Words($ImagePath) {
  $bitmap = Read-Bitmap $ImagePath
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if (-not $engine) { throw 'Windows OCR is not available.' }
  $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
  $words = @()
  foreach ($line in $result.Lines) {
    foreach ($word in $line.Words) {
      $rect = $word.BoundingRect
      $words += [pscustomobject]@{
        t = $word.Text
        x = [int]$rect.X
        y = [int]$rect.Y
        w = [int]$rect.Width
        h = [int]$rect.Height
      }
    }
  }
  $words
}

function Save-Prepared($SourcePath, $DestPath) {
  $source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath).Path)
  try {
    $long = [Math]::Max($source.Width, $source.Height)
    $scale = if ($long -lt 1600) { 2.0 } elseif ($long -gt 2400) { 2400 / $long } else { 1.4 }
    $width = [Math]::Max(1, [int]($source.Width * $scale))
    $height = [Math]::Max(1, [int]($source.Height * $scale))
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($source, 0, 0, $width, $height)
    $g.Dispose()
    $rect = New-Object System.Drawing.Rectangle 0, 0, $width, $height
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $stride = $data.Stride
    $bytes = New-Object byte[] ($stride * $height)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
    $sum = 0.0
    $count = 0
    for ($i = 0; $i -lt $bytes.Length; $i += 3) {
      $sum += ($bytes[$i] * 0.114 + $bytes[$i + 1] * 0.587 + $bytes[$i + 2] * 0.299)
      $count++
    }
    $mean = $sum / [Math]::Max(1, $count)
    $dark = $mean -lt 110
    for ($i = 0; $i -lt $bytes.Length; $i += 3) {
      for ($c = 0; $c -lt 3; $c++) {
        $v = $bytes[$i + $c]
        if ($dark) { $v = 255 - $v }
        $v = [int](($v - 128) * 1.65 + 128)
        if ($v -lt 0) { $v = 0 }
        if ($v -gt 255) { $v = 255 }
        $bytes[$i + $c] = [byte]$v
      }
    }
    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $data.Scan0, $bytes.Length)
    $bmp.UnlockBits($data)
    $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } finally {
    $source.Dispose()
  }
}

$prepared = Join-Path ([System.IO.Path]::GetTempPath()) ("daily-plate-label-" + [guid]::NewGuid().ToString() + ".png")
try {
  Save-Prepared $Path $prepared
  $words = @(Read-Words $prepared)
  $lines = @()
  foreach ($word in ($words | Sort-Object y, x)) {
    $placed = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
      $line = $lines[$i]
      if ([Math]::Abs($word.y - $line.y) -le [Math]::Max(12, $word.h * 0.6)) {
        $line.words += $word
        $line.y = [int](($line.y + $word.y) / 2)
        $placed = $true
        break
      }
    }
    if (-not $placed) {
      $lines += [pscustomobject]@{ y = $word.y; words = @($word) }
    }
  }
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  foreach ($line in ($lines | Sort-Object y)) {
    $text = (($line.words | Sort-Object x | ForEach-Object { $_.t }) -join ' ').Trim()
    if ($text) { Write-Output $text }
  }
} finally {
  if (Test-Path -LiteralPath $prepared) { Remove-Item -LiteralPath $prepared -Force }
}
