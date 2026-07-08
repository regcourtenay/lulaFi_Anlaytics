# Custom ClickHouse image that bakes in the low-resource tuning config.
# NOTE: `docker COPY` preserves the source file's mode bits, and the file may be
# 0700 in the build context (e.g. after unzip), which the internal `clickhouse`
# user cannot read -> "Access to file denied". The explicit chmod makes it
# world-readable (0644) so ClickHouse always starts. Multi-arch base (arm64/Pi 5).
FROM clickhouse/clickhouse-server:24.8
COPY low-resource.xml /etc/clickhouse-server/config.d/low-resource.xml
RUN chmod 0644 /etc/clickhouse-server/config.d/low-resource.xml
