#!/usr/bin/env bash
set -euo pipefail

PRINTER_NAME="${1:-MP-2800TH-UTP}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_FILE="$PROJECT_ROOT/native/printing/rastertohappycash-escpos.c"
BUILD_DIR="$(mktemp -d)"
FILTER_BINARY="$BUILD_DIR/rastertohappycash-escpos"
CURRENT_PPD="$BUILD_DIR/current.ppd"
HAPPYCASH_PPD="$BUILD_DIR/happycash.ppd"

cleanup() {
  rm -rf "$BUILD_DIR"
}
trap cleanup EXIT

DEVICE_URI="$(LC_ALL=C lpstat -v "$PRINTER_NAME" | sed -n 's/^[^:]*: //p')"
if [[ -z "$DEVICE_URI" ]]; then
  echo "Impressora $PRINTER_NAME nao encontrada no CUPS." >&2
  exit 1
fi

curl --fail --silent --show-error \
  "http://localhost:631/printers/${PRINTER_NAME}.ppd" \
  --output "$CURRENT_PPD"

cc -O2 -Wall -Wextra -Werror "$SOURCE_FILE" -o "$FILTER_BINARY" -lcups
sed 's/rastertotmtr/rastertohappycash-escpos/g' "$CURRENT_PPD" > "$HAPPYCASH_PPD"

sudo install -o root -g root -m 0755 \
  "$FILTER_BINARY" /usr/lib/cups/filter/rastertohappycash-escpos
sudo lpadmin -p "$PRINTER_NAME" -E -v "$DEVICE_URI" -P "$HAPPYCASH_PPD"

lpoptions -p "$PRINTER_NAME" \
  -o PageSize=RP80x2000 \
  -o media=RP80x2000 \
  -o fitplot=false \
  -o TmxPaperReduction=Bottom \
  -o TmxPaperCut=CutPerJob

sudo cupsenable "$PRINTER_NAME"
sudo cupsaccept "$PRINTER_NAME"

echo "Driver ESC/POS HappyCash instalado em $PRINTER_NAME."
echo "Nenhuma pagina de teste foi enviada."
