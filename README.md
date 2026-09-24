Seekee Browser GrayJay v0.2k

What is implemented:
- ES5 GrayJay source.
- Uses the confirmed Seekee/Buscari API host.
- Uses the APK-confirmed route:
  /quan/app/content/recommend/v2/detailPageQuery
- Attempts several parameter shapes for content detail because the React Native
  bundle is minified and does not expose a readable TypeScript signature.
- Recursively extracts real http(s) .m3u8/.mp4/.mpd media URLs returned by the API.
- Extracts VTT/SRT/ASS subtitle URLs when present.
- Detects the optional GrayJay Browser package without inventing Browser methods.

Important limitation:
- The APK analysis did not prove a text-search HTTP route. Therefore this
  version does NOT pretend that /model_search/* is an HTTP API.
- Likewise, the exact JavaScript methods/signatures exposed by PackageBrowser
  are runtime-dependent and are not fabricated here.
- If the detail API response contains actual playback URLs, this version can
  expose them directly to GrayJay. If the playback URL is only generated inside
  a WebView, the next revision needs the exact PackageBrowser runtime API.

Confirmed APK facts:
- Package: com.enzo.paulo
- Version: Seekee 2.14.0
- API host: https://h5-api.buscari.com
- API path string: /quan/app/content/recommend/v2/detailPageQuery
- APK contains WebView/resource-sniffing UI resources.

Install:
1. Import SeekeeBrowserConfig.json into GrayJay.
2. Keep Browser package enabled if the runtime supports it.
3. Enable debug logging while testing.

Do not treat a returned URL as playable merely because it contains the word
"stream"; the resolver only accepts HTTP(S) media-looking URLs.
