# 06 — UI/UX: url-shortener

- Tarih: 2026-07-27 | Mod: AUTOPILOT | Profil: LITE
- Ürün tipi: service/API — yüzey sözleşmesi = endpoint sözleşmesi

## Yüzey sözleşmesi (endpoint tablosu)
| Metod | Yol | Açıklama | Başarı | Hata |
|-------|-----|----------|--------|------|
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

## Çıktı/görsel şablonları
- Başarı (201): `{"code": string, "short_url": string}`
- Hata formatı (tüm 4xx/5xx): `{"error": "<snake_case_kod>", "message": "<insan-okur TR açıklama>"}`
- Hata kodları: `invalid_url` (400), `not_found` (404), `internal_error` (500 — kod tükenmesi, ≤3 retry sonrası)

## Tasarım notları
- Ton: kısa, teknik, TR hata mesajı; emoji yok (API yanıtı).
- Erişilebilirlik: N/A (arayüz yok, saf HTTP sözleşmesi).
- `short_url` = `BASE_URL` env + `/` + code; `BASE_URL` yoksa yalnız `code` döner (varsayım, DL-06-001).

## Kalite kapısı raporu
- "Ana kullanıcı akışları uçtan uca çizildi" → ✅ FR-1 (Akış 1 kısaltma), FR-2 (Akış 1 yönlendirme + Akış 3 404), FR-3 (Akış 2 400) — üçü de kapsandı.
