Add-Type -AssemblyName System.Drawing

function Draw-Logo([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::FromArgb(255, 7, 17, 31))
  $blue = [System.Drawing.Color]::FromArgb(255, 44, 125, 255)
  $white = [System.Drawing.Color]::White
  $brush = New-Object System.Drawing.SolidBrush $white
  $ring = New-Object System.Drawing.Pen $blue, ([single]([Math]::Max(2, $size * 0.055)))
  $margin = $size * 0.12
  $g.DrawEllipse($ring, $margin, $margin, $size - (2 * $margin), $size - (2 * $margin))
  $plate = $size * 0.34
  $g.FillEllipse($brush, ($size - $plate) / 2, $size * 0.40, $plate, $plate)
  $rim = New-Object System.Drawing.Pen $blue, ([single]([Math]::Max(1.5, $size * 0.028)))
  $g.DrawEllipse($rim, ($size - $plate) / 2, $size * 0.40, $plate, $plate)
  $barY = $size * 0.48
  $bar = New-Object System.Drawing.Pen $blue, ([single]([Math]::Max(2, $size * 0.035)))
  $bar.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bar.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($bar, $size * 0.22, $barY, $size * 0.78, $barY)
  $plateW = $size * 0.055
  $plateH = $size * 0.16
  $g.FillRectangle($brush, $size * 0.20, $barY - ($plateH / 2), $plateW, $plateH)
  $g.FillRectangle($brush, $size * 0.745, $barY - ($plateH / 2), $plateW, $plateH)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $blue), $size * 0.212, $barY - ($plateH / 2) + ($size * 0.012), $plateW * 0.55, $plateH - ($size * 0.024))
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $blue), $size * 0.757, $barY - ($plateH / 2) + ($size * 0.012), $plateW * 0.55, $plateH - ($size * 0.024))
  $g.Dispose()
  return $bmp
}

function Dib-Bytes($bmp) {
  $w = $bmp.Width
  $h = $bmp.Height
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $data.Stride
  $raw = New-Object byte[] ($stride * $h)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $raw, 0, $raw.Length)
  $bmp.UnlockBits($data)
  $row = $w * 4
  $pixels = New-Object byte[] ($row * $h)
  for ($y = 0; $y -lt $h; $y++) {
    [Array]::Copy($raw, ($h - 1 - $y) * $stride, $pixels, $y * $row, $row)
  }
  $maskRow = [int]([Math]::Ceiling($w / 32.0) * 4)
  $mask = New-Object byte[] ($maskRow * $h)
  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter $ms
  $bw.Write([uint32]40)
  $bw.Write([int32]$w)
  $bw.Write([int32]($h * 2))
  $bw.Write([uint16]1)
  $bw.Write([uint16]32)
  $bw.Write([uint32]0)
  $bw.Write([uint32]($pixels.Length + $mask.Length))
  $bw.Write([int32]0)
  $bw.Write([int32]0)
  $bw.Write([uint32]0)
  $bw.Write([uint32]0)
  $bw.Write($pixels)
  $bw.Write($mask)
  $bw.Flush()
  $bytes = $ms.ToArray()
  $bw.Dispose()
  return $bytes
}

$root = Split-Path $PSScriptRoot -Parent
$public = Join-Path $root "public"
$launcher = $PSScriptRoot
$sizes = 16, 32, 48, 256
$images = New-Object System.Collections.Generic.List[byte[]]
foreach ($size in $sizes) {
  $bmp = Draw-Logo $size
  $images.Add((Dib-Bytes $bmp))
  if ($size -eq 256) {
    $big = Draw-Logo 192
    $big.Save((Join-Path $public "icon-192.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $big.Dispose()
    $bigger = Draw-Logo 512
    $bigger.Save((Join-Path $public "icon-512.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bigger.Dispose()
  }
  $bmp.Dispose()
}

$fs = [System.IO.File]::Create((Join-Path $launcher "DailyPlate.ico"))
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$images.Count)
Write-Output ("image bytes " + (($images | ForEach-Object { $_.Length }) -join ", "))
$offset = 6 + (16 * $images.Count)
for ($i = 0; $i -lt $images.Count; $i++) {
  $dim = $sizes[$i]
  $bw.Write([byte]$(if ($dim -ge 256) { 0 } else { $dim }))
  $bw.Write([byte]$(if ($dim -ge 256) { 0 } else { $dim }))
  $bw.Write([byte]0)
  $bw.Write([byte]0)
  $bw.Write([uint16]1)
  $bw.Write([uint16]32)
  $bw.Write([uint32]$images[$i].Length)
  $bw.Write([uint32]$offset)
  $offset += $images[$i].Length
}
foreach ($png in $images) { $bw.Write($png) }
$bw.Flush()
$bw.Dispose()
$fs.Dispose()
Write-Output "ico ready"
