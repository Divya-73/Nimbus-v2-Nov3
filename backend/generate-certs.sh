#!/bin/sh
set -eu

CERT_DIR=/backend-cert
ES_EXPORT=/opt-es
FORCE_REGEN_CERTS=${FORCE_REGEN_CERTS:-false}

if [ ! -s "$ES_EXPORT/ahES.crt" ]; then
  echo "Required OpenSearch CA certificate missing: /opt/ES/ahES.crt" >&2
  exit 1
fi
if [ ! -s "$ES_EXPORT/ahNMC.crt" ]; then
  echo "Required MQTT CA certificate missing: /opt/ES/ahNMC.crt" >&2
  exit 1
fi

mkdir -p "$CERT_DIR"
cp "$ES_EXPORT/ahES.crt" "$CERT_DIR/ahES.crt"
cp "$ES_EXPORT/ahNMC.crt" "$CERT_DIR/ahNMC.crt"
chmod 0644 "$CERT_DIR/ahES.crt" "$CERT_DIR/ahNMC.crt"

certificate_matches_ips() {
  san_list=$1
  previous_ifs=$IFS
  IFS=,
  set -- $san_list
  IFS=$previous_ifs
  for san_ip do
    san_ip=$(printf '%s' "$san_ip" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
    if [ -n "$san_ip" ] && ! openssl x509 -in "$CERT_DIR/cert.pem" -noout -checkip "$san_ip" >/dev/null 2>&1; then
      return 1
    fi
  done
  return 0
}

CERTIFICATE_MATCHES=false
if [ -s "$CERT_DIR/key.pem" ] && [ -s "$CERT_DIR/cert.pem" ]; then
  apk add --no-cache openssl >/dev/null
  if openssl x509 -in "$CERT_DIR/cert.pem" -noout -checkhost "$NIMBUS_FQDN" >/dev/null 2>&1 \
    && certificate_matches_ips "${NIMBUS_PRIVATE_IPS:-}" \
    && certificate_matches_ips "${NIMBUS_PUBLIC_IPS:-}"; then
    CERTIFICATE_MATCHES=true
  fi
fi

if [ "$FORCE_REGEN_CERTS" = true ] || [ "$CERTIFICATE_MATCHES" != true ]; then
  apk add --no-cache openssl >/dev/null
  WORK_DIR=$(mktemp -d)
  trap 'rm -rf "$WORK_DIR"' EXIT

  cat > "$WORK_DIR/server.cnf" <<EOF
[req]
prompt = no
distinguished_name = dn
x509_extensions = v3_req
[dn]
O = ${NIMBUS_COMPANY:-Nimbus}
CN = $NIMBUS_FQDN
[v3_req]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
[alt_names]
DNS.1 = $NIMBUS_FQDN
DNS.2 = localhost
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

  next_ip_san=$(add_ip_sans 2 "${NIMBUS_PRIVATE_IPS:-}")
  add_ip_sans "$next_ip_san" "${NIMBUS_PUBLIC_IPS:-}" >/dev/null

  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
    -keyout "$WORK_DIR/key.pem" -out "$WORK_DIR/cert.pem" \
    -config "$WORK_DIR/server.cnf"
  cp "$WORK_DIR/key.pem" "$CERT_DIR/key.pem"
  cp "$WORK_DIR/cert.pem" "$CERT_DIR/cert.pem"
  echo "Generated backend HTTPS certificate for $NIMBUS_FQDN."
else
  echo "Backend HTTPS key.pem and cert.pem already exist; skipping generation."
fi

chmod 0600 "$CERT_DIR/key.pem"
chmod 0644 "$CERT_DIR/cert.pem"
