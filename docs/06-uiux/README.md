# 06 — UI/UX: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Profil: LITE
- Ürün tipi: service/API — yüzey sözleşmesi = endpoint sözleşmesi
- **REQ-003 delta (2026-07-31):** FR-4 ile ürün ilk kez gerçek bir web arayüzü kazanıyor; "Erişilebilirlik: N/A, arayüz yok" notu aşağıda GÜNCELLENDİ.

## Yüzey sözleşmesi (endpoint tablosu)
| Metod | Yol | Açıklama | Başarı | Hata |
|-------|-----|----------|--------|------|
| GET | / | Web arayüzü — URL kısaltma formu (FR-4) | 200 | - |
| GET | /app.js | Formun istemci tarafı script'i (FR-4) | 200 | - |
| POST | /api/shorten | URL kısaltır (FR-1) | 201 | 400 (geçersiz URL, FR-3) |
| GET | /:code | Kısa koddan yönlendirir (FR-2) | 302 | 404 (bilinmeyen kod) |
| GET | /health | Canlılık kontrolü | 200 | - |

## Ana akış(lar) — uçtan uca (kalite kapısı)

**Akış 1 — Kısalt → Yönlendir (FR-1 + FR-2)**
```
> POST /api/shorten {"url":"https://example.com/very/long/path"}
< 201 {"code":"aZ3kQ9x","short_url":"https://short.ly/aZ3kQ9x"}

> GET /aZ3kQ9x
< 302 Location: https://example.com/very/long/path
```

**Akış 2 — Geçersiz URL reddi (FR-3)**
```
> POST /api/shorten {"url":"javascript:alert(1)"}
< 400 {"error":"invalid_url","message":"Yalnız http/https şeması kabul edilir"}
```

**Akış 3 — Bilinmeyen kod (FR-2, negatif)**
```
> GET /zzzz999
< 404 {"error":"not_found","message":"Kısa kod bulunamadı"}
```

**Akış 4 — Web arayüzünden kısaltma (FR-4, REQ-003)**
```
1. Ziyaretçi tarayıcıda GET / açar → form (tek metin girişi + "Kısalt" düğmesi) görür.
2. URL girip gönderir → sayfa JS'i fetch('/api/shorten', POST) çağırır (Akış 1 ile aynı sözleşme).
3. Başarı → kısa link aynı sayfada gösterilir (textContent ile, kopyala düğmesi).
4. Hata (geçersiz URL) → API'nin {"message":...} alanı aynı sayfada gösterilir (textContent ile), form bozulmaz.
```

## Ekran taslağı (metin — framework/CSS yok, DL-04-003)
```
┌───────────────────────────────┐
│  url-shortener                │
│  ┌───────────────────────────┐│
│  │ https://...                ││  ← <input type="url">
│  └───────────────────────────┘│
│  [ Kısalt ]                    │  ← submit
│                                │
│  Sonuç: https://x/aZ3kQ9x  📋 │  ← başarı (yalnız POST sonrası görünür)
│  Hata: Yalnız http/https şeması│  ← hata (yalnız POST sonrası, karşılıklı dışlar)
└───────────────────────────────┘
```

## Çıktı/görsel şablonları
- Başarı (201): `{"code": string, "short_url": string}`
- Hata formatı (tüm 4xx/5xx): `{"error": "<snake_case_kod>", "message": "<insan-okur TR açıklama>"}`
- Hata kodları: `invalid_url` (400), `not_found` (404), `internal_error` (500 — kod tükenmesi, ≤3 retry sonrası)

## Tasarım notları
- Ton: kısa, teknik, TR hata mesajı; emoji yok (API yanıtı).
- **Erişilebilirlik (REQ-003 ile güncellendi):** form standart HTML `<label>`+`<input type="url">`+`<button>` kullanır (ekran okuyucu ile uyumlu); ayrıca stil/CSS framework yok — tarayıcı varsayılan render'ı yeterli (DL-04-003 sıfır-bağımlılık kararıyla tutarlı).
- `short_url` = `BASE_URL` env + `/` + code; `BASE_URL` yoksa yalnız `code` döner (varsayım, DL-06-001) — form bu durumda yalnız `code`'u gösterir (link değil).
- **Güvenlik (Faz 7'ye bağlı):** sonuç/hata metni DOM'a yalnız `textContent` ile yazılır (`innerHTML` YOK) — kullanıcı girdisi veya API mesajı script olarak yorumlanmaz (XSS).

## Kalite kapısı raporu
- "Ana kullanıcı akışları uçtan uca çizildi" → ✅ FR-1 (Akış 1 kısaltma), FR-2 (Akış 1 yönlendirme + Akış 3 404), FR-3 (Akış 2 400), FR-4 (Akış 4 web arayüzü + ekran taslağı) — dördü de kapsandı.
