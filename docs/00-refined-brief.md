# 00 — Rafine Proje Brief'i: url-shortener

- Tarih: 2026-07-26 | Rafine eden model: Sonnet (hızlı) | Onay durumu: **Onaylandı** (dashboard, 2026-07-26)

## Ham fikir (kullanıcının girdisi — değiştirilmez)
> url kısaltıcı uygulama yaz.

## Rafine problem (tek cümle)
Kullanıcıların uzun URL'leri kısa, paylaşılabilir bir bağlantıya çevirip bu bağlantıya erişildiğinde orijinal adrese yönlendirilmesini sağlayan bir web uygulaması yok.

## Hedef kitle
Uzun linkleri (sosyal medya, mesajlaşma, dokümantasyon) kısaltıp paylaşmak isteyen genel/solo kullanıcı.

## Kısıtlar & varsayımlar (AF-001 kapanışı)
- Platform/runtime: Web servisi (backend API + basit arayüz); Node.js
- Çevrimiçi/çevrimdışı, veri konumu: Çevrimiçi; kısaltma eşlemeleri sunucu tarafında (dosya/DB) saklanır
- Zaman/kota bütçesi: Solo/MVP ölçek — LITE profil
- Varsayımlar: Kullanıcı hesabı/girişi v1'de YOK (anonim kısaltma); özel/istenen kısa kod desteği olmayabilir (rastgele üretim varsayıldı)

## Başarı kriterleri (ölçülebilir)
1. Bir URL gönderildiğinde ≤ 200ms içinde benzersiz kısa kod üretilir
2. Kısa linke istek geldiğinde orijinal URL'e 3xx yönlendirme %100 doğrulukla çalışır
3. Geçersiz/bozuk URL girişi kayıt öncesi reddedilir (doğrulama hatası oranı %100 yakalanır)

## Kapsam sınırı (v1'de yapılmayacaklar)
- Kullanıcı hesabı, giriş, kişisel link geçmişi
- Tıklama analitiği/istatistik paneli
- Özel (custom) kısa kod seçimi
- Link son kullanma tarihi/otomatik silme

## Açık sorular (kullanıcının netleştirmesi önerilen)
- [ ] Tıklama sayısı/analitik ileride istenecek mi, yoksa gerçekten sadece kısalt+yönlendir mi yeterli?
- [ ] Kısaltılan linkler kalıcı mı olmalı, yoksa bir süre sonra silinsin mi?
- [ ] Basit bir web arayüzü (form) mi yeterli, yoksa yalnız API mi yeterli?

## Önerilen profil ve ilk mod
- Profil: LITE · Gerekçe: Solo/MVP ölçek, tek kullanıcı akışı, düşük risk yüzeyi — hızlı teslim önceliği.

---
## Onay kaydı
- 2026-07-26 — Beklemede
