# Draws the app's PNG icons (same design as app/icons/icon.svg). No installs needed.
#   powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\app\icons'

function Draw-Icon([int]$size, [string]$file, [bool]$maskable) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $s = $size / 512.0
  $ink = [System.Drawing.ColorTranslator]::FromHtml('#1F2321')
  $paper = [System.Drawing.ColorTranslator]::FromHtml('#F3F1EE')
  $green = [System.Drawing.ColorTranslator]::FromHtml('#3E8A66')

  if ($maskable) {
    $g.Clear($ink)
    $k = 0.8          # keep the drawing inside the maskable safe zone
    $off = 512 * (1 - $k) / 2
  } else {
    $k = 1.0; $off = 0
    $r = 112 * $s; $d = 2 * $r
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90); $path.AddArc(0, $size - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush $ink), $path)
  }
  function P([double]$x, [double]$y) { New-Object System.Drawing.PointF ([float](($off + $x * $k) * $s)), ([float](($off + $y * $k) * $s)) }

  $pen = New-Object System.Drawing.Pen $paper, ([float](34 * $k * $s))
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
  $g.DrawLines($pen, [System.Drawing.PointF[]]@((P 120 236), (P 256 124), (P 392 236)))
  $g.DrawLines($pen, [System.Drawing.PointF[]]@((P 150 214), (P 150 386), (P 362 386), (P 362 214)))
  $door = P 226 290
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $green), $door.X, $door.Y, [float](60 * $k * $s), [float](96 * $k * $s))

  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Draw-Icon 192 'icon-192.png' $false
Draw-Icon 512 'icon-512.png' $false
Draw-Icon 512 'icon-512-maskable.png' $true
Write-Host 'Icons written to' (Resolve-Path $out)
