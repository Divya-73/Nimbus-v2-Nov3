#!/bin/sh
set -eu

CERT_DIR=/mqtt-certs
MQTT_EXPORT=/export-mqtt
ES_EXPORT=/export-es
mkdir -p "$CERT_DIR" "$MQTT_EXPORT" "$ES_EXPORT"
COMPANY="${NIMBUS_COMPANY:-Systrome}"
FORCE_REGEN_CERTS=${FORCE_REGEN_CERTS:-false}
HOST_BUNDLE_IMPORTED=false

host_bundle_complete() {
  [ -s "$ES_EXPORT/ahNMC.crt" ] && [ -s "$ES_EXPORT/sysNMC.crt" ] && [ -s "$ES_EXPORT/sysNMC.key" ]
}

host_bundle_empty() {
  [ ! -e "$ES_EXPORT/ahNMC.crt" ] && [ ! -e "$ES_EXPORT/sysNMC.crt" ] && [ ! -e "$ES_EXPORT/sysNMC.key" ]
}

volume_bundle_complete() {
  [ -s "$CERT_DIR/ca.crt" ] && [ -s "$CERT_DIR/server.crt" ] && [ -s "$CERT_DIR/server.key" ]
}

import_host_bundle() {
  cp "$ES_EXPORT/ahNMC.crt" "$CERT_DIR/ca.crt"
  cp "$ES_EXPORT/sysNMC.crt" "$CERT_DIR/server.crt"
  cp "$ES_EXPORT/sysNMC.key" "$CERT_DIR/server.key"
  touch "$CERT_DIR/.nimbus-generated"
}

export_host_bundle() {
  cp "$CERT_DIR/ca.crt" "$ES_EXPORT/ahNMC.crt"
  cp "$CERT_DIR/server.crt" "$ES_EXPORT/sysNMC.crt"
  cp "$CERT_DIR/server.key" "$ES_EXPORT/sysNMC.key"
  chmod 0644 "$ES_EXPORT/ahNMC.crt" "$ES_EXPORT/sysNMC.crt"
  chmod 0600 "$ES_EXPORT/sysNMC.key"
}

export_runtime_bundle() {
  cp "$CERT_DIR/ca.crt" "$MQTT_EXPORT/ca.crt"
  cp "$CERT_DIR/server.crt" "$MQTT_EXPORT/server.crt"
  cp "$CERT_DIR/server.key" "$MQTT_EXPORT/server.key"
}

if [ "$FORCE_REGEN_CERTS" != true ] && host_bundle_complete; then
  echo "Certificates found in /opt/ES, skipping generation and importing into mqtt-certs."
  import_host_bundle
  HOST_BUNDLE_IMPORTED=true
elif [ "$FORCE_REGEN_CERTS" != true ] && host_bundle_empty && volume_bundle_complete; then
  echo "MQTT certificates already exist in mqtt-certs; skipping generation."
else
  apk add --no-cache openssl >/dev/null
  WORK_DIR=$(mktemp -d)
  trap 'rm -rf "$WORK_DIR"' EXIT

  openssl genrsa -out "$WORK_DIR/ca.key" 4096
  openssl req -x509 -new -nodes -key "$WORK_DIR/ca.key" \
    -sha256 -days 1826 -out "$CERT_DIR/ca.crt" \
    -subj "/O=$COMPANY/CN=$COMPANY MQTT Root CA"

  openssl genrsa -out "$CERT_DIR/server.key" 2048
  cat > "$WORK_DIR/server.cnf" <<EOF
[req]
prompt = no
distinguished_name = dn
req_extensions = req_ext
[dn]
O = $COMPANY
CN = $MQTT_HOST
[req_ext]
subjectAltName = @alt_names
[alt_names]
DNS.1 = $MQTT_HOST
DNS.2 = $NIMBUS_FQDN
DNS.3 = nimbus-mosquitto
DNS.4 = localhost
DNS.5 = mosquitto
IP.1 = 127.0.0.1
EOF

  add_ip_sans() {
    san_number=$1
    san_list=$2
    previous_ifs=$IFS
    IFS=,
    set -- $san_list
    IFS=$previous_ifs
    for san_ip do
      san_ip=$(printf '%s' "$san_ip" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
      if [ -n "$san_ip" ]; then
        printf 'IP.%s = %s\n' "$san_number" "$san_ip" >> "$WORK_DIR/server.cnf"
        san_number=$((san_number + 1))
      fi
    done
    printf '%s\n' "$san_number"
  }
  next_ip_san=$(add_ip_sans 2 "${NIMBUS_PRIVATE_IPS:-${NIMBUS_PRIVATE_IP:-}}")
  next_ip_san=$(add_ip_sans "$next_ip_san" "${NIMBUS_PUBLIC_IPS:-${NIMBUS_PUBLIC_IP:-}}")
  case "$MQTT_HOST" in
    *[!0-9.]* ) : ;;
    * ) add_ip_sans "$next_ip_san" "$MQTT_HOST" >/dev/null ;;
  esac

  openssl req -new -key "$CERT_DIR/server.key" \
    -out "$WORK_DIR/server.csr" -config "$WORK_DIR/server.cnf"
  openssl x509 -req -in "$WORK_DIR/server.csr" \
    -CA "$CERT_DIR/ca.crt" -CAkey "$WORK_DIR/ca.key" -CAcreateserial \
    -out "$CERT_DIR/server.crt" -days 1826 -sha256 \
    -extfile "$WORK_DIR/server.cnf" -extensions req_ext
  touch "$CERT_DIR/.nimbus-generated"
fi

apk add --no-cache mosquitto >/dev/null
printf '%s\n%s\n' "$MQTT_PASSWORD" "$MQTT_PASSWORD" \
  | mosquitto_passwd -c "$CERT_DIR/ahpass.txt" "$MQTT_USERNAME"
chown 1883:1883 "$CERT_DIR/server.key" "$CERT_DIR/server.crt" "$CERT_DIR/ca.crt" "$CERT_DIR/ahpass.txt"
chmod 0400 "$CERT_DIR/server.key" "$CERT_DIR/ahpass.txt"
chmod 0444 "$CERT_DIR/server.crt" "$CERT_DIR/ca.crt"
if [ "$HOST_BUNDLE_IMPORTED" != true ]; then
  export_host_bundle
fi
export_runtime_bundle
cp "$CERT_DIR/ahpass.txt" "$MQTT_EXPORT/ahpass.txt"
chown 1883:1883 "$MQTT_EXPORT/server.crt" "$MQTT_EXPORT/server.key" "$MQTT_EXPORT/ahpass.txt"
chmod 0444 "$MQTT_EXPORT/ca.crt" "$MQTT_EXPORT/server.crt"
chmod 0400 "$MQTT_EXPORT/server.key" "$MQTT_EXPORT/ahpass.txt"
echo "MQTT TLS certificate and password file are ready for $MQTT_HOST."
