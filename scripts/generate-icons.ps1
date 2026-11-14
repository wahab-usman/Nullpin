Add-Type -AssemblyName System.Drawing

$outputDir = Resolve-Path "public"
$sizes = @(256, 128, 64, 48, 32, 16)

function Draw-NullPinIcon([int]$dim) {
    $bmp = New-Object System.Drawing.Bitmap $dim, $dim, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # 1. Dark background squircle (#09090B)
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 9, 9, 11))
    $radius = [Math]::Max(2, [int]($dim * 0.22))
    $diameter = $radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $diameter, $diameter, 180, 90)
    $path.AddArc($dim - $diameter, 0, $diameter, $diameter, 270, 90)
    $path.AddArc($dim - $diameter, $dim - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc(0, $dim - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $g.FillPath($bgBrush, $path)

    # 2. Ambient emerald radial glow
    $glowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(50, 16, 185, 129))
    $glowRect = New-Object System.Drawing.Rectangle ([int]($dim * 0.12)), ([int]($dim * 0.12)), ([int]($dim * 0.76)), ([int]($dim * 0.76))
    $g.FillEllipse($glowBrush, $glowRect)

    # 3. Outer Hexagon Shield in glowing emerald (#10B981)
    $penWidth = [Math]::Max(1.5, [float]($dim * 0.055))
    $emeraldPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 16, 185, 129)), $penWidth
    $emeraldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $pts = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new([float]($dim * 0.50), [float]($dim * 0.18)),
        [System.Drawing.PointF]::new([float]($dim * 0.78), [float]($dim * 0.34)),
        [System.Drawing.PointF]::new([float]($dim * 0.78), [float]($dim * 0.66)),
        [System.Drawing.PointF]::new([float]($dim * 0.50), [float]($dim * 0.82)),
        [System.Drawing.PointF]::new([float]($dim * 0.22), [float]($dim * 0.66)),
        [System.Drawing.PointF]::new([float]($dim * 0.22), [float]($dim * 0.34))
    )
    $g.DrawPolygon($emeraldPen, $pts)

    # 4. White core center circle
    $coreBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $coreR = [float]($dim * 0.09)
    $g.FillEllipse($coreBrush, [float]($dim * 0.50 - $coreR), [float]($dim * 0.50 - $coreR), [float]($coreR * 2), [float]($coreR * 2))

    # 5. Emerald inner pin dot
    $innerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
    $innerR = [float]($dim * 0.04)
    $g.FillEllipse($innerBrush, [float]($dim * 0.50 - $innerR), [float]($dim * 0.50 - $innerR), [float]($innerR * 2), [float]($innerR * 2))

    $g.Dispose()
    return $bmp
}

# 1. Generate crisp 512x512 PNG
$icon512 = Draw-NullPinIcon 512
$png512Path = Join-Path $outputDir "icon-512.png"
$icon512.Save($png512Path, [System.Drawing.Imaging.ImageFormat]::Png)
$icon512.Dispose()
Write-Host "Created $png512Path"

# 2. Generate multi-resolution ICO containing 256, 128, 64, 48, 32, 16
$pngBlobs = @()
foreach ($s in $sizes) {
    $bmp = Draw-NullPinIcon $s
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()
    $pngBlobs += ,@($s, $bytes)
}

$icoPath = Join-Path $outputDir "icon.ico"
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter $fs

# ICO Header
$bw.Write([UInt16]0)                # Reserved
$bw.Write([UInt16]1)                # Type 1 = Icon
$bw.Write([UInt16]$pngBlobs.Count)  # Image count

# Calculate initial offset for image data (Header = 6, each directory entry = 16 bytes)
$offset = 6 + ($pngBlobs.Count * 16)

# Write Directory Entries
foreach ($item in $pngBlobs) {
    $s = $item[0]
    $bytes = $item[1]

    $w = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $h = if ($s -ge 256) { [byte]0 } else { [byte]$s }

    $bw.Write([byte]$w)             # Width (0 = 256)
    $bw.Write([byte]$h)             # Height (0 = 256)
    $bw.Write([byte]0)              # Color count (0 = >=8bpp)
    $bw.Write([byte]0)              # Reserved
    $bw.Write([UInt16]1)            # Planes
    $bw.Write([UInt16]32)           # Bits per pixel
    $bw.Write([UInt32]$bytes.Length)# Image data size
    $bw.Write([UInt32]$offset)      # Offset of image data
    $offset += $bytes.Length
}

# Write Image Data (PNG streams)
foreach ($item in $pngBlobs) {
    $bytes = $item[1]
    $bw.Write($bytes)
}

$bw.Flush()
$fs.Dispose()
Write-Host "Created $icoPath with sizes: $($sizes -join ', ')"
