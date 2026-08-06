#!/usr/bin/env bash
# One-request, no-crawl 1mg source health probe for Dalekdefender.
set -Eeuo pipefail

[ "$EUID" -eq 0 ] || {
  echo "REFUSED: source health probe must run as root."
  exit 2
}
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

readonly MARK=0xa05
readonly PRIORITY=3997
readonly LAN_IF=enx00e04c3e5d80
readonly HOST=www.1mg.com
readonly PATH_ONLY=/robots.txt
readonly LOCK=/run/lock/aushadhi-network-hook.lock

added_rule=0
added_nat=0

cleanup() {
  set +e
  if [ "$added_nat" = 1 ]; then
    iptables -t nat -D POSTROUTING -o "$LAN_IF" \
      -m mark --mark "$MARK" -j MASQUERADE
  fi
  if [ "$added_rule" = 1 ]; then
    ip rule del fwmark "$MARK" lookup main priority "$PRIORITY"
  fi
  set -e
}
trap cleanup EXIT

umask 077
exec 9>>"$LOCK"
if ! flock -n 9; then
  echo "REFUSED: crawler network configuration is changing; retry later."
  exit 2
fi

service_state="$(systemctl show aushadhi-crawl.service -p ActiveState --value 2>/dev/null || true)"
if [ "$service_state" != "inactive" ] && [ "$service_state" != "failed" ]; then
  echo "REFUSED: aushadhi-crawl.service state is '$service_state'; do not alter its routing."
  exit 2
fi

if ip rule show | grep -q "fwmark 0xa05"; then
  echo "REFUSED: a crawler route rule already exists while the service is inactive."
  exit 2
fi

if iptables -t mangle -C OUTPUT -m cgroup \
  --path system.slice/aushadhi-crawl.service -j MARK --set-mark "$MARK" 2>/dev/null; then
  echo "REFUSED: crawler mangle rule already exists while the service is inactive."
  exit 2
fi

if iptables -t nat -C POSTROUTING -o "$LAN_IF" \
  -m mark --mark "$MARK" -j MASQUERADE 2>/dev/null; then
  echo "REFUSED: crawler NAT rule already exists while service is inactive."
  exit 2
fi

ip rule add fwmark "$MARK" lookup main priority "$PRIORITY"
added_rule=1
iptables -t nat -A POSTROUTING -o "$LAN_IF" \
  -m mark --mark "$MARK" -j MASQUERADE
added_nat=1

ip=$(getent ahostsv4 "$HOST" | awk 'NR == 1 { print $1 }')
if [ -z "$ip" ]; then
  echo "ERROR: no IPv4 DNS result for $HOST"
  exit 3
fi

route=$(ip route get "$ip" mark "$MARK")
printf '%s\n' '--- marked route ---'
printf '%s\n' "$route"
if [[ "$route" != *"dev $LAN_IF"* ]]; then
  echo "ERROR: marked route did not select $LAN_IF"
  exit 3
fi

printf '%s\n' '--- one robots.txt request ---'
probe_rc=0
python3 - "$HOST" "$PATH_ONLY" "$MARK" <<'PY' || probe_rc=$?
import socket
import ssl
import sys

host, path, mark_text = sys.argv[1:]
mark = int(mark_text, 0)
user_agent = "AushadhiSourceHealthCheck/1.0 (+https://bahuleyan.com)"

ip = socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(12)
sock.setsockopt(socket.SOL_SOCKET, 36, mark)
sock.connect((ip, 443))

context = ssl.create_default_context()
tls = context.wrap_socket(sock, server_hostname=host)
request = (
    f"GET {path} HTTP/1.1\r\n"
    f"Host: {host}\r\n"
    f"User-Agent: {user_agent}\r\n"
    "Accept: text/plain,*/*;q=0.1\r\n"
    "Connection: close\r\n\r\n"
).encode()
tls.sendall(request)

response = b""
while b"\r\n\r\n" not in response and len(response) < 16384:
    chunk = tls.recv(4096)
    if not chunk:
        break
    response += chunk

lines = response.decode("iso-8859-1", "replace").split("\r\n")
status_line = next((line for line in lines if line.startswith("HTTP/")), None)
if status_line is None:
    print("ERROR: source returned no HTTP status line", file=sys.stderr)
    tls.close()
    raise SystemExit(3)
try:
    status_code = int(status_line.split()[1])
except (IndexError, ValueError):
    print(f"ERROR: malformed HTTP status line: {status_line}", file=sys.stderr)
    tls.close()
    raise SystemExit(3)

for line in lines:
    if line.startswith("HTTP/") or line.lower().startswith((
        "server:", "cf-ray:", "retry-after:", "content-type:"
    )):
        print(line)
tls.close()
if status_code != 200:
    print(f"ERROR: 1mg source health returned HTTP {status_code}", file=sys.stderr)
    raise SystemExit(4)
PY

cleanup
trap - EXIT

if ip rule show | grep -q "^[[:space:]]*$PRIORITY:.*fwmark 0xa05.*lookup main"; then
  echo "ERROR: route cleanup did not complete"
  exit 4
fi
if iptables -t nat -C POSTROUTING -o "$LAN_IF" \
  -m mark --mark "$MARK" -j MASQUERADE 2>/dev/null; then
  echo "ERROR: NAT cleanup did not complete"
  exit 4
fi

if [ "$probe_rc" -ne 0 ]; then
  exit "$probe_rc"
fi

echo "probe_cleanup=complete"
