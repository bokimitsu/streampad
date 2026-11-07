# Serves the project on http://localhost:8766/ for testing the userscript against saved snapshots.
#   http://localhost:8766/snapshots/Home.htm  -> snapshot with the GM shim + userscript injected
# A Content-Security-Policy blocks every request that would leave this machine (live site,
# image CDN, player domain), so testing never touches AnimePahe itself.
param([int]$Port = 8766)

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{ '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'; '.js' = 'text/javascript';
            '.css' = 'text/css'; '.svg' = 'image/svg+xml'; '.webp' = 'image/webp'; '.png' = 'image/png'; '.json' = 'application/json' }
$csp = "<meta http-equiv=`"Content-Security-Policy`" content=`"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:`">"
$inject = '<script src="/tools/dev/gm-shim.js"></script><script src="/animepahe-tv.user.js"></script>'

$http = New-Object System.Net.HttpListener
$http.Prefixes.Add("http://localhost:$Port/")
$http.Start()
Write-Host "Serving $root on http://localhost:$Port/"

while ($http.IsListening) {
    $ctx = $http.GetContext(); $req = $ctx.Request; $res = $ctx.Response
    try {
        $rel  = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
        $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
        if (-not $path.StartsWith($root) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
            $res.StatusCode = 404
        } else {
            $ext = [IO.Path]::GetExtension($path).ToLower()
            $res.ContentType = $types[$ext]
            $res.Headers['Cache-Control'] = 'no-store'
            if ($ext -eq '.htm' -and $rel -like 'snapshots/*') {
                $html = [IO.File]::ReadAllText($path)
                $html = ([regex]'<head[^>]*>').Replace($html, { param($m) $m.Value + $csp }, 1)
                $html = $html.Replace('</body>', $inject + '</body>')
                $bytes = [Text.Encoding]::UTF8.GetBytes($html)
            } else {
                $bytes = [IO.File]::ReadAllBytes($path)
            }
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
    } catch { Write-Host "Error: $_"; $res.StatusCode = 500 }
    finally { $res.Close() }
}
