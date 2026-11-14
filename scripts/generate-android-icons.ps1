Add-Type -AssemblyName System.Drawing

$srcIcon = "public/icon-512.png"
if (-not (Test-Path $srcIcon)) {
    Write-Error "Source icon not found: $srcIcon"
    exit 1
}

$mipmapSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

$srcBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcIcon))

foreach ($folder in $mipmapSizes.Keys) {
    $dim = $mipmapSizes[$folder]
    $destFolder = "android/app/src/main/res/$folder"
    if (Test-Path $destFolder) {
        $resized = New-Object System.Drawing.Bitmap $dim, $dim
        $g = [System.Drawing.Graphics]::FromImage($resized)
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($srcBmp, 0, 0, $dim, $dim)
        $g.Dispose()

        $launcherPath = Join-Path $destFolder "ic_launcher.png"
        $roundPath = Join-Path $destFolder "ic_launcher_round.png"
        $foregroundPath = Join-Path $destFolder "ic_launcher_foreground.png"

        $resized.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $resized.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $resized.Save($foregroundPath, [System.Drawing.Imaging.ImageFormat]::Png)

        $resized.Dispose()
        Write-Host "Updated icons for $folder ($dim x $dim)"
    }
}

$srcBmp.Dispose()
Write-Host "All Android mipmap icons generated successfully!"

