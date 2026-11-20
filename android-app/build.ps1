$ErrorActionPreference = 'Stop'

$ToolsDir = "D:\Restore-2026-11-02\player\iptv-ui\.android-tools"
$JdkHome = Join-Path $ToolsDir "jdk\jdk-17.0.20.1+1"
$JdkBin = Join-Path $JdkHome "bin"
$env:JAVA_HOME = $JdkHome
$env:PATH = "$JdkBin;$env:PATH"

$SdkDir = Join-Path $ToolsDir "sdk"
$BuildTools = Join-Path $SdkDir "build-tools\35.0.0"
$AndroidJar = Join-Path $SdkDir "platforms\android-36\android.jar"

$Aapt2 = Join-Path $BuildTools "aapt2.exe"
$D8 = Join-Path $BuildTools "d8.bat"
$Zipalign = Join-Path $BuildTools "zipalign.exe"
$ApkSigner = Join-Path $BuildTools "apksigner.bat"
$Javac = Join-Path $JdkBin "javac.exe"
$Keytool = Join-Path $JdkBin "keytool.exe"
$Jar = Join-Path $JdkBin "jar.exe"

$AppDir = "D:\SR\android-app"
$BuildDir = Join-Path $AppDir "build"
$ResDir = Join-Path $AppDir "src\main\res"
$Manifest = Join-Path $AppDir "src\main\AndroidManifest.xml"
$JavaDir = Join-Path $AppDir "src\main\java\com\copagostar\widget"

Remove-Item -Recurse -Force $BuildDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BuildDir, (Join-Path $BuildDir "gen"), (Join-Path $BuildDir "classes"), (Join-Path $BuildDir "dex") | Out-Null

Write-Host "==> Compiling resources with aapt2"
$resZip = Join-Path $BuildDir "res.zip"
& $Aapt2 compile --dir $ResDir -o $resZip
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

Write-Host "==> Linking resources with aapt2"
$unalignedApk = Join-Path $BuildDir "app-unaligned.apk"
$genDir = Join-Path $BuildDir "gen"
& $Aapt2 link -o $unalignedApk -I $AndroidJar --manifest $Manifest --java $genDir $resZip --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

Write-Host "==> Compiling Java sources"
$classesDir = Join-Path $BuildDir "classes"
$javaFiles = @(Get-ChildItem -Path $genDir, $JavaDir -Filter "*.java" -Recurse | Select-Object -ExpandProperty FullName)
& $Javac -encoding UTF-8 -source 17 -target 17 -d $classesDir -cp $AndroidJar $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

Write-Host "==> Dexing classes with d8"
$dexDir = Join-Path $BuildDir "dex"
$classFiles = @(Get-ChildItem -Path $classesDir -Filter "*.class" -Recurse | Select-Object -ExpandProperty FullName)
& cmd /c "$D8" --output $dexDir --lib $AndroidJar $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Write-Host "==> Adding classes.dex to APK"
Push-Location $dexDir
& $Jar uf $unalignedApk classes.dex
Pop-Location

Write-Host "==> Zipaligning APK"
$alignedApk = Join-Path $BuildDir "app-aligned.apk"
& $Zipalign -f -p 4 $unalignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "==> Signing APK"
$keystore = Join-Path $BuildDir "debug.keystore"
if (-not (Test-Path $keystore)) {
    & $Keytool -genkeypair -v -keystore $keystore -alias androiddebugkey -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Android Debug,O=Android,C=US"
}

$finalApk = Join-Path $BuildDir "CopaSalesWidget.apk"
& cmd /c "$ApkSigner" sign --ks $keystore --ks-pass pass:android --key-pass pass:android --out $finalApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

Write-Host "==> APK Built Successfully: $finalApk"
