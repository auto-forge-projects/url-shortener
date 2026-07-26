#!/usr/bin/env bash
# AutoForge SSH-push uzak KALDIRMA (soft undeploy). CI bunu sunucuda `bash -s` ile çalıştırır.
# Env: PROJECT HOST
# Yaptığı: container'ı durdur+sil → bu projenin nginx bloğunu kaldır → nginx -t + reload.
# YALNIZ bu projeye dokunur (kendi adıyla + kendi HOST conf'u). Repo/imaj SİLİNMEZ (soft).
# nginx -t geçmeden reload YOK → mevcut siteler (wordchain/n8n vb.) güvende.
set -euo pipefail
: "${PROJECT:?} ${HOST:?}"

docker rm -f "$PROJECT" >/dev/null 2>&1 || true

CONF="/etc/nginx/sites-available/${HOST}.conf"
LINK="/etc/nginx/sites-enabled/${HOST}.conf"
# 2.12: conf'u kaldırmadan ÖNCE yedekle. nginx -t (başka bir site bozuk olabilir) başarısızsa
# bu projenin conf'unu GERİ YÜKLE → yarım-kaldırılmış tutarsız durum bırakma (eskiden: conf
# silinmiş ama reload atlanmış → nginx bellekte eski config'le, disk ile uyumsuz).
BAK="$(mktemp)"; sudo cp "$CONF" "$BAK" 2>/dev/null || true
sudo rm -f "$LINK" "$CONF"
if sudo nginx -t; then
  sudo systemctl reload nginx
  rm -f "$BAK"
  echo "torn down: ${HOST} (container + nginx bloğu kaldırıldı)"
else
  if [ -s "$BAK" ]; then sudo cp "$BAK" "$CONF"; sudo ln -sf "$CONF" "$LINK"; fi
  rm -f "$BAK"
  echo "UYARI: nginx -t başarısız — teardown GERİ ALINDI (conf geri yüklendi); başka bir site bozuk olabilir." >&2
  exit 1
fi
