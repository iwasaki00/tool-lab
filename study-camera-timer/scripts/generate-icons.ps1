param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-FocusLensIcon {
  param(
    [int]$Size,
    [string]$Destination
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#f4f5f3'))

  $margin = [float]($Size * 0.075)
  $radius = [float]($Size * 0.19)
  $card = [System.Drawing.RectangleF]::new($margin, $margin, $Size - 2 * $margin, $Size - 2 * $margin)
  $cardPath = New-RoundedRectanglePath -Rectangle $card -Radius $radius
  $cardBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#2f6f63'))
  $graphics.FillPath($cardBrush, $cardPath)

  $center = [float]($Size / 2)
  $outerRadius = [float]($Size * 0.305)
  $outer = [System.Drawing.RectangleF]::new($center - $outerRadius, $center - $outerRadius, $outerRadius * 2, $outerRadius * 2)
  $ringBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#173d36'))
  $graphics.FillEllipse($ringBrush, $outer)

  $innerRadius = [float]($Size * 0.245)
  $inner = [System.Drawing.RectangleF]::new($center - $innerRadius, $center - $innerRadius, $innerRadius * 2, $innerRadius * 2)
  $faceBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#f4f5f3'))
  $graphics.FillEllipse($faceBrush, $inner)

  $tickPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#78958e'), [float]($Size * 0.018))
  $tickPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $tickPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  foreach ($angle in @(0, 90, 180, 270)) {
    $radians = ($angle - 90) * [Math]::PI / 180
    $from = $innerRadius * 0.74
    $to = $innerRadius * 0.88
    $x1 = $center + [Math]::Cos($radians) * $from
    $y1 = $center + [Math]::Sin($radians) * $from
    $x2 = $center + [Math]::Cos($radians) * $to
    $y2 = $center + [Math]::Sin($radians) * $to
    $graphics.DrawLine($tickPen, [float]$x1, [float]$y1, [float]$x2, [float]$y2)
  }

  $handPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#202624'), [float]($Size * 0.035))
  $handPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $handPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($handPen, $center, $center, [float]($center - $Size * 0.095), [float]($center - $Size * 0.11))
  $graphics.DrawLine($handPen, $center, $center, [float]($center + $Size * 0.13), [float]($center - $Size * 0.16))

  $hubRadius = [float]($Size * 0.036)
  $hubBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#2f6f63'))
  $graphics.FillEllipse($hubBrush, $center - $hubRadius, $center - $hubRadius, $hubRadius * 2, $hubRadius * 2)

  $signalRadius = [float]($Size * 0.055)
  $signalX = [float]($Size * 0.735)
  $signalY = [float]($Size * 0.255)
  $signalBorder = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#f4f5f3'))
  $graphics.FillEllipse($signalBorder, $signalX - $signalRadius * 1.35, $signalY - $signalRadius * 1.35, $signalRadius * 2.7, $signalRadius * 2.7)
  $signalBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#2f6f63'))
  $graphics.FillEllipse($signalBrush, $signalX - $signalRadius, $signalY - $signalRadius, $signalRadius * 2, $signalRadius * 2)

  $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)

  $signalBrush.Dispose()
  $signalBorder.Dispose()
  $hubBrush.Dispose()
  $handPen.Dispose()
  $tickPen.Dispose()
  $faceBrush.Dispose()
  $ringBrush.Dispose()
  $cardBrush.Dispose()
  $cardPath.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
New-FocusLensIcon -Size 192 -Destination (Join-Path $OutputDirectory 'icon-192.png')
New-FocusLensIcon -Size 512 -Destination (Join-Path $OutputDirectory 'icon-512.png')

Write-Output "Generated Focus Lens icons in $OutputDirectory"
