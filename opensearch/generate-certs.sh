#!/bin/sh
set -eu

CERT_DIR=/certs
EXPORT_DIR=/export
FORCE_REGEN_CERTS=${FORCE_REGEN_CERTS:-false}

host_bundle_complete() {
  [ -s "$EXPORT_DIR/ahES.crt" ] && [ -s "$EXPORT_DIR/sysES.crt" ] && [ -s "$EXPORT_DIR/sysES.key" ]
}

host_bundle_empty() {
  [ ! -e "$EXPORT_DIR/ahES.crt" ] && [ ! -e "$EXPORT_DIR/sysES.crt" ] && [ ! -e "$EXPORT_DIR/sysES.key" ]
}

volume_bundle_complete() {
  [ -s "$CERT_DIR/root-ca.pem" ] && [ -s "$CERT_DIR/node.pem" ] && [ -s "$CERT_DIR/node-key.pem" ]
}

import_host_bundle() {
  mkdir -p "$CERT_DIR"
  cp "$EXPORT_DIR/ahES.crt" "$CERT_DIR/root-ca.pem"
  cp "$EXPORT_DIR/sysES.crt" "$CERT_DIR/node.pem"
  cp "$EXPORT_DIR/sysES.key" "$CERT_DIR/node-key.pem"
  chown 1000:1000 "$CERT_DIR/node-key.pem" "$CERT_DIR/node.pem" "$CERT_DIR/root-ca.pem"
  chmod 0600 "$CERT_DIR/node-key.pem"
  chmod 0644 "$CERT_DIR/node.pem" "$CERT_DIR/root-ca.pem"
}

export_volume_bundle() {
  mkdir -p "$EXPORT_DIR"
  cp "$CERT_DIR/root-ca.pem" "$EXPORT_DIR/ahES.crt"
  cp "$CERT_DIR/node.pem" "$EXPORT_DIR/sysES.crt"
  cp "$CERT_DIR/node-key.pem" "$EXPORT_DIR/sysES.key"
  chmod 0644 "$EXPORT_DIR/ahES.crt" "$EXPORT_DIR/sysES.crt"
  chmod 0600 "$EXPORT_DIR/sysES.key"
}

if [ "$FORCE_REGEN_CERTS" != true ] && host_bundle_complete; then
  echo "Certificates found in /opt/ES, skipping generation and importing into opensearch-certs."
  import_host_bundle
  exit 0
fi

if [ "$FORCE_REGEN_CERTS" != true ] && host_bundle_empty && volume_bundle_complete; then
  echo "OpenSearch certificates already exist in opensearch-certs; skipping generation."
  export_volume_bundle
  exit 0
fi

apk add --no-cache openssl >/dev/null
mkdir -p "$CERT_DIR"
WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

FQDN="$NIMBUS_FQDN"
COUNTRY="${NIMBUS_COUNTRY:-IN}"
STATE="${NIMBUS_STATE:-Haryana}"
CITY="${NIMBUS_CITY:-Gurugram}"
COMPANY="${NIMBUS_COMPANY:-Divya}"

openssl genrsa -out "$WORK_DIR/root-ca-key.pem" 4096
openssl req -new -x509 -sha256 -days 1826 \
  -key "$WORK_DIR/root-ca-key.pem" \
  -out "$CERT_DIR/root-ca.pem" \
  -subj "/C=$COUNTRY/O=$COMPANY/CN=$COMPANY OpenSearch Root CA"

openssl genrsa -out "$WORK_DIR/node-key-temp.pem" 2048
openssl pkcs8 -inform PEM -outform PEM \
  -in "$WORK_DIR/node-key-temp.pem" -topk8 -nocrypt \
  -out "$CERT_DIR/node-key.pem"

cat > "$WORK_DIR/node.cnf" <<EOF
[req]
prompt = no
distinguished_name = dn
req_extensions = req_ext
[dn]
C = $COUNTRY
ST = $STATE
L = $CITY
O = $COMPANY
OU = OpenSearch
CN = $FQDN
[req_ext]
subjectAltName = @alt_names
[alt_names]
DNS.1 = $FQDN
DNS.2 = nimbus-node
DNS.3 = localhost
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
      printf 'IP.%s = %s\n' "$san_number" "$san_ip" >> "$WORK_DIR/node.cnf"
      san_number=$((san_number + 1))
    fi
  done
  printf '%s\n' "$san_number"
}

next_ip_san=$(add_ip_sans 2 "${NIMBUS_PRIVATE_IPS:-${NIMBUS_PRIVATE_IP:-}}")
next_ip_san=$(add_ip_sans "$next_ip_san" "${NIMBUS_PUBLIC_IPS:-${NIMBUS_PUBLIC_IP:-}}")
case "$OPENSEARCH_HOST" in
  *[!0-9.]* ) printf 'DNS.4 = %s\n' "$OPENSEARCH_HOST" >> "$WORK_DIR/node.cnf" ;;
  * ) add_ip_sans "$next_ip_san" "$OPENSEARCH_HOST" >/dev/null ;;
esac

cat > "$WORK_DIR/node-ext.cnf" <<EOF
[default]
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth,clientAuth
subjectAltName=@alt_names
EOF
cat "$WORK_DIR/node.cnf" | sed -n '/^\[alt_names\]/,$p' >> "$WORK_DIR/node-ext.cnf"

openssl req -new -key "$CERT_DIR/node-key.pem" \
  -out "$WORK_DIR/node.csr" -config "$WORK_DIR/node.cnf"
openssl x509 -req -in "$WORK_DIR/node.csr" \
  -CA "$CERT_DIR/root-ca.pem" -CAkey "$WORK_DIR/root-ca-key.pem" \
  -CAcreateserial -out "$CERT_DIR/node.pem" -days 1826 -sha256 \
  -extfile "$WORK_DIR/node-ext.cnf"

chown 1000:1000 "$CERT_DIR/node-key.pem" "$CERT_DIR/node.pem" "$CERT_DIR/root-ca.pem"
chmod 0600 "$CERT_DIR/node-key.pem"
chmod 0644 "$CERT_DIR/node.pem" "$CERT_DIR/root-ca.pem"
export_volume_bundle
echo "OpenSearch TLS certificates created for $FQDN."
