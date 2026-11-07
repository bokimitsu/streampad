# Serves tools/gamepad-tester on http://localhost:8765/ and saves POST /report bodies
# to tools/gamepad-tester/reports/. The TV reaches it through `adb reverse tcp:8765 tcp:8765`,
# which makes it "localhost" for Firefox there — a secure context, which the Gamepad API requires.
param([int]$Port = 8765)

$root    = Join-Path $PSScriptRoot "gamepad-tester"
$reports = Join-Path $root "reports"
New-Item -ItemType Directory -Force $reports | Out-Null
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript'; '.css' = 'text/css'; '.json' = 'application/json' }

$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:$Port/")
$http.Start()
Write-Host "Serving $root on http://localhost:$Port/"

while ($http.IsListening) {
    $ctx = $http.GetContext(); $req = $ctx.Request; $res = $ctx.Response
    try {
        if ($req.HttpMethod -eq 'POST' -and $req.Url.AbsolutePath -eq '/report') {
            $body = (New-Object System.IO.StreamReader($req.InputStream, [Text.Encoding]::UTF8)).ReadToEnd()
            $file = Join-Path $reports ("report-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
            [IO.File]::WriteAllText($file, $body)
            Write-Host "Saved $file"
            $res.StatusCode = 204
        } else {
            $rel  = $req.Url.AbsolutePath.TrimStart('/'); if (-not $rel) { $rel = 'index.html' }
            $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
            if ($path.StartsWith($root) -and (Test-Path -LiteralPath $path -PathType Leaf)) {
                $bytes = [IO.File]::ReadAllBytes($path)
                $res.ContentType = $types[[IO.Path]::GetExtension($path)]
                $res.Headers['Cache-Control'] = 'no-store'
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else { $res.StatusCode = 404 }
        }
        Write-Host "$($req.HttpMethod) $($req.Url.AbsolutePath) -> $($res.StatusCode)"
    } catch { Write-Host "Error: $_"; $res.StatusCode = 500 }
    finally { $res.Close() }
}
