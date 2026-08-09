Add-Type -AssemblyName System.Drawing

function New-HamoLabIcon([int]$Size, [string]$Path) {
  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#102d2a'))
  $mint = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#a7d7bf')), ([Math]::Max(8, $Size * 0.035))
  $coral = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#e56f54')), ([Math]::Max(8, $Size * 0.035))
  $mint.StartCap = $mint.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $coral.StartCap = $coral.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pointsA = @(
    (New-Object System.Drawing.PointF ($Size * .17), ($Size * .62)),
    (New-Object System.Drawing.PointF ($Size * .36), ($Size * .32)),
    (New-Object System.Drawing.PointF ($Size * .55), ($Size * .68)),
    (New-Object System.Drawing.PointF ($Size * .83), ($Size * .35))
  )
  $pointsB = @(
    (New-Object System.Drawing.PointF ($Size * .17), ($Size * .42)),
    (New-Object System.Drawing.PointF ($Size * .38), ($Size * .68)),
    (New-Object System.Drawing.PointF ($Size * .62), ($Size * .36)),
    (New-Object System.Drawing.PointF ($Size * .83), ($Size * .58))
  )
  $graphics.DrawCurve($mint, $pointsA, .45)
  $graphics.DrawCurve($coral, $pointsB, .45)
  $graphics.Dispose(); $mint.Dispose(); $coral.Dispose()
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path -Parent $scriptDir
$iconDir = Join-Path $appDir 'icons'
New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
New-HamoLabIcon 192 (Join-Path $iconDir 'icon-192.png')
New-HamoLabIcon 512 (Join-Path $iconDir 'icon-512.png')
