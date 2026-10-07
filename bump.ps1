$ts = [int]([double]::Parse((Get-Date -UFormat %s)))
$v = "131bb-$ts"
$files = Get-ChildItem -Path $PSScriptRoot -Filter *.html
foreach ($f in $files) {
    $c = Get-Content $f.FullName -Raw
    $origLen = $c.Length
    if ($c -match 'styles\.css\?v=[\w\-]+') {
        $c = $c -replace 'styles\.css\?v=[\w\-]+', "styles.css?v=$v"
    }
    if ($c -match 'theme\.js\?v=[\w\-]+') {
        $c = $c -replace 'theme\.js\?v=[\w\-]+', "theme.js?v=$v"
    }
    if ($c.Length -gt 1000) {
        Set-Content $f.FullName -NoNewline -Value $c
        Write-Host "[OK] $($f.Name) ($origLen -> $($c.Length))"
    } else {
        Write-Host "[SKIP] $($f.Name) too small ($($c.Length))"
    }
}
Write-Host ""
Write-Host "Cache version: $v"
