# SNMP Recording Files

These `.snmprec` files are used with [snmpsim](https://github.com/etingof/snmpsim) for integration testing.

## Format

Each line follows the format:
```
OID|TYPE|VALUE
```

Type codes:
- `2` = Integer
- `4` = OctetString
- `6` = ObjectIdentifier
- `65` = Counter32
- `66` = Gauge32
- `67` = TimeTicks

## Recording from a real device

```bash
snmprec-record-commands \
  --protocol-version=2c \
  --community=public \
  --agent-udpv4-endpoint=192.168.1.1 \
  --output-file=my-device.snmprec
```

## Using with snmpsim

```bash
snmpsim-command-responder \
  --data-dir=./testdata/snmprec \
  --agent-udpv4-endpoint=127.0.0.1:1161
```
