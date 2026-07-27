# 01-02 — Değer & Fizibilite (LITE birleşik faz): url-shortener

> LITE profil: yarım sayfa hedefi, paydaş analizi yok.

- Tarih: 2026-07-26 | Mod: AUTOPILOT | Profil: LITE

## Değer önerisi
Uzun URL'leri saniyeler içinde kısa, paylaşılabilir bir bağlantıya çeviren; hesap/kurulum gerektirmeyen basit bir web servisi.

## KPI'lar (kalite kapısı: en az 3, ölçülebilir)
1. Bir URL gönderildiğinde ≤200ms içinde benzersiz kısa kod üretilir (otomatik testle ölçülür).
2. Kısa linke istek geldiğinde orijinal URL'e 3xx yönlendirme %100 doğrulukla çalışır (entegrasyon testi).
3. Geçersiz/bozuk URL girişi kayıt öncesi %100 reddedilir (doğrulama testi).

## Fizibilite
- Teknik: Node.js backend + basit anahtar-değer eşleme (kısa kod → orijinal URL) düşük risklidir; kısa kod üretimi (rastgele base62) kanıtlanmış, standart bir yaklaşımdır. ✅
- Ekonomik: Sıfıra yakın altyapı maliyeti (tek küçük servis, dosya/hafif DB depolama). ✅
- Zaman: LITE MVP kapsamı (hesapsız, analitiksiz, tek uç nokta çifti: kısalt + yönlendir) 1 günden az geliştirme gerektirir. ✅

## GO / NO-GO önerisi: **GO**
Gerekçe: Teknik risk düşük (standart kısaltma/yönlendirme deseni), maliyet düşük, kapsam net ve dar (brief'te v1 dışı bırakılanlar netleştirilmiş). Üç ölçülebilir KPI ile ilerlemek uygun.

## Kalite kapısı raporu
- "En az 3 ölçülebilir KPI" → ✅ (yukarıda 3 KPI, hedef + ölçüm yöntemiyle)
- "GO/NO-GO kararı gerekçeli" → ✅ (GO, teknik/ekonomik/zaman gerekçesiyle)
