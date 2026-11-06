<?php
/**
 * Tatvic First-Party Relay Proxy (PHP / WordPress / Laravel Drop-in)
 *
 * Receives first-party analytics requests from the Tatvic Wrapper,
 * morphs GTM scripts to bypass ad blockers, and preserves Tag Assistant preview mode.
 */

// 1. Check if request is for the Morphed GTM loader
$uri = $_SERVER['REQUEST_URI'];
$containerId = $_GET['cid'] ?? $_GET['container'] ?? $_GET['tag'] ?? $_GET['id'] ?? '';
if (strpos($uri, 'loader.js') !== false || strpos($uri, 'gtm.js') !== false || (!empty($containerId) && preg_match('/^GTM-[A-Z0-9]+$/i', $containerId))) {
    if (!empty($containerId)) {
        $queryParams = $_GET;
        $queryParams['id'] = $containerId;
        unset($queryParams['cid'], $queryParams['container'], $queryParams['tag']);
        $queryString = http_build_query($queryParams);
        $upstreamUrl = "https://www.googletagmanager.com/gtm.js?" . $queryString;

        $ch = curl_init($upstreamUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0');
        $rawGtm = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && !empty($rawGtm)) {
            // Morph GTM script to route through first-party proxy
            $proxyPath = '/tatvic-proxy.php';
            $replacements = [
                'https://adservice.google.com/' => $proxyPath . '?_tgt=' . urlencode('https://adservice.google.com/'),
                'https://www.googleadservices.com/' => $proxyPath . '?_tgt=' . urlencode('https://www.googleadservices.com/'),
                'https://pagead2.googlesyndication.com/' => $proxyPath . '?_tgt=' . urlencode('https://pagead2.googlesyndication.com/'),
                'https://ad.doubleclick.net/' => $proxyPath . '?_tgt=' . urlencode('https://ad.doubleclick.net/'),
                'https://www.google-analytics.com/' => $proxyPath . '?_tgt=' . urlencode('https://www.google-analytics.com/'),
                'https://analytics.google.com/' => $proxyPath . '?_tgt=' . urlencode('https://analytics.google.com/'),
            ];

            $morphed = str_replace(array_keys($replacements), array_values($replacements), $rawGtm);

            header('Content-Type: application/javascript; charset=UTF-8');
            header('Access-Control-Allow-Origin: *');
            if (isset($_GET['gtm_debug'])) {
                header('Cache-Control: no-cache, no-store, must-revalidate');
            } else {
                header('Cache-Control: public, max-age=900');
            }
            echo $morphed;
            exit;
        }
    }
}

// 2. Preconfigured Allowed Domains (SSRF Protection)
$allowedDomains = [
    'google-analytics.com',
    'analytics.google.com',
    'googletagmanager.com',
    'stats.g.doubleclick.net',
    'googleadservices.com',
    'adservice.google.com',
    'pagead2.googlesyndication.com',
    'ad.doubleclick.net',
    'google.com',
    // sGTM Providers (Stape, Cloud Run)
    'stape.io',
    'stape.net',
    'a.run.app',
    'appspot.com',
    'connect.facebook.net',
    'facebook.com',
    'graph.facebook.com',
    'clarity.ms',
    'c.bing.com',
    'bat.bing.com',
    'analytics.tiktok.com',
    'tiktok.com',
    'static.hotjar.com',
    'script.hotjar.com',
    'static.ads-twitter.com',
    'snap.licdn.com',
    'ct.pinterest.com',
    'sc-static.net',
    'static.criteo.net',
    'segment.io',
    'mixpanel.com',
    'amplitude.com',
    'heapanalytics.com',
    'posthog.com'
];

// 3. Extract Target URL
$headerName = 'HTTP_X_TATVIC_TARGET';
$targetUrl = isset($_SERVER[$headerName]) ? $_SERVER[$headerName] : null;

if (!$targetUrl && isset($_GET['_tgt'])) {
    $targetUrl = $_GET['_tgt'];
}

if (!$targetUrl) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Missing target destination']);
    exit;
}

// 4. Validate URL & Domain
$parsed = parse_url($targetUrl);
if (!$parsed || !isset($parsed['host']) || !in_array($parsed['scheme'], ['http', 'https'])) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Malformed target URL']);
    exit;
}

$host = strtolower($parsed['host']);
$isAllowed = false;
foreach ($allowedDomains as $allowed) {
    if ($host === $allowed || substr($host, -strlen('.' . $allowed)) === '.' . $allowed) {
        $isAllowed = true;
        break;
    }
}

if (!$isAllowed) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Target host is not permitted']);
    exit;
}

// 5. Forward Request via cURL
$method = $_SERVER['REQUEST_METHOD'];
$body = file_get_contents('php://input');

$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

// Forward Headers
$forwardHeaders = [];
$strip = ['host', 'authorization', 'connection', 'content-length', 'content-type'];
foreach (getallheaders() as $name => $value) {
    $lower = strtolower($name);
    if (!in_array($lower, $strip) && $lower !== 'x-tatvic-target') {
        $forwardHeaders[] = "$name: $value";
    }
}

if (isset($_SERVER['CONTENT_TYPE'])) {
    $forwardHeaders[] = "Content-Type: " . $_SERVER['CONTENT_TYPE'];
}

// Client IP
$clientIp = isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? $_SERVER['HTTP_X_FORWARDED_FOR'] : $_SERVER['REMOTE_ADDR'];
$forwardHeaders[] = "X-Forwarded-For: $clientIp";

curl_setopt($ch, CURLOPT_HTTPHEADER, $forwardHeaders);

if ($method !== 'GET' && $method !== 'HEAD' && !empty($body)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);

if (curl_errno($ch)) {
    http_response_code(502);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Relay error: ' . curl_error($ch)]);
    curl_close($ch);
    exit;
}

$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$resHeaders = substr($response, 0, $headerSize);
$resBody = substr($response, $headerSize);

// Emit response
http_response_code($httpCode);
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: *, x-tatvic-target');

echo $resBody;
