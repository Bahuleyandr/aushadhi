import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEPLOY = path.join(ROOT, 'deploy', 'dalekdefender');

const read = (name) => fs.readFileSync(path.join(DEPLOY, name), 'utf8');

const longRunningUnits = [
  ['aushadhi-crawl.service', 'AUSHADHI_DAILY_CAP=20000', 'onemg', 'crawl.log'],
  ['aushadhi-apollo.service', 'AUSHADHI_APOLLO_CAP=10000', 'apollo', 'apollo.log'],
  ['aushadhi-pharmeasy.service', 'AUSHADHI_PHARMEASY_CAP=20000', 'pharmeasy', 'pharmeasy.log'],
  ['aushadhi-netmeds.service', 'AUSHADHI_NETMEDS_CAP=20000', 'netmeds', 'netmeds.log'],
];

test('tracked crawler units reproduce the hardened non-root /opt deployment', () => {
  for (const [name, cap, source, logName] of longRunningUnits) {
    const unit = read(name);
    assert.doesNotMatch(unit, /\/root\/aushadhi/);
    assert.match(unit, /^User=aushadhi$/m, name);
    assert.match(unit, /^Group=aushadhi$/m, name);
    assert.match(unit, /^WorkingDirectory=\/opt\/aushadhi$/m, name);
    assert.match(unit, new RegExp(`^Environment=${cap}$`, 'm'), name);
    assert.match(unit, /^Environment=AUSHADHI_RAW_ROOT=\/var\/lib\/aushadhi\/data\/raw$/m, name);
    assert.match(unit, /^Environment=AUSHADHI_DIST_ROOT=\/var\/lib\/aushadhi\/dist$/m, name);
    assert.match(unit, /^NoNewPrivileges=true$/m, name);
    assert.match(unit, /^ProtectSystem=strict$/m, name);
    assert.match(unit, /^ProtectHome=true$/m, name);
    assert.match(unit, new RegExp(`^Environment=HOME=/var/cache/aushadhi/${source}$`, 'm'), name);
    assert.match(unit, new RegExp(`^Environment=XDG_CACHE_HOME=/var/cache/aushadhi/${source}$`, 'm'), name);
    assert.match(unit, new RegExp(`^StateDirectory=aushadhi/data/raw/${source}$`, 'm'), name);
    assert.match(unit, new RegExp(`^LogsDirectory=aushadhi/${source}$`, 'm'), name);
    assert.match(unit, new RegExp(`^CacheDirectory=aushadhi/${source}$`, 'm'), name);
    assert.match(unit, /^ReadOnlyPaths=\/opt\/aushadhi \/var\/lib\/aushadhi\/dist \/var\/lib\/aushadhi\/data\/raw$/m, name);
    assert.match(unit, new RegExp(`^ReadWritePaths=/var/lib/aushadhi/data/raw/${source} /var/log/aushadhi/${source} /var/cache/aushadhi/${source}$`, 'm'), name);
    assert.match(unit, new RegExp(`^ExecStartPre=\\+\/usr\/local\/libexec\/aushadhi-network-hook ${name} start$`, 'm'), name);
    assert.match(unit, new RegExp(`^ExecStopPost=\\+\/usr\/local\/libexec\/aushadhi-network-hook ${name} stop$`, 'm'), name);
    assert.match(unit, new RegExp(`^StandardOutput=append:/var/log/aushadhi/${source}/${logName}$`, 'm'), name);
  }
});

test('tracked build, export, and retention units are fail-closed and resource bounded', () => {
  const build = read('aushadhi-build.service');
  assert.doesNotMatch(build, /\/root\/aushadhi/);
  assert.match(build, /^OnSuccess=aushadhi-export.service$/m);
  assert.match(build, /^User=aushadhi$/m);
  assert.match(build, /^WorkingDirectory=\/opt\/aushadhi$/m);
  assert.match(build, /^Environment=AUSHADHI_RAW_ROOT=\/var\/lib\/aushadhi\/data\/raw$/m);
  assert.match(build, /^Environment=AUSHADHI_DIST_ROOT=\/var\/lib\/aushadhi\/dist$/m);
  assert.match(build, /^Environment=AUSHADHI_BUILD_RECEIPT_DIR=\/var\/lib\/aushadhi\/build-receipts$/m);
  assert.match(build, /^Environment=AUSHADHI_DERIVED_ROOT=\/var\/cache\/aushadhi\/build\/derived$/m);
  assert.match(build, /^Environment=AUSHADHI_NIGHTLY_BUILD_MAX_AGE_SECONDS=604800$/m);
  assert.match(build, /^Environment=HOME=\/var\/cache\/aushadhi\/build$/m);
  assert.match(build, /^Environment=XDG_CACHE_HOME=\/var\/cache\/aushadhi\/build$/m);
  assert.match(build, /^StateDirectory=aushadhi\/dist aushadhi\/build-receipts$/m);
  assert.match(build, /^MemoryHigh=7G$/m);
  assert.match(build, /^MemoryMax=8G$/m);
  assert.match(build, /^ReadOnlyPaths=\/opt\/aushadhi \/var\/lib\/aushadhi\/data\/raw$/m);
  assert.match(build, /^LogsDirectory=aushadhi\/build$/m);
  assert.match(build, /^CacheDirectory=aushadhi\/build$/m);
  assert.match(build, /^ReadWritePaths=\/var\/lib\/aushadhi\/dist \/var\/lib\/aushadhi\/build-receipts \/var\/log\/aushadhi\/build \/var\/cache\/aushadhi\/build$/m);

  const exporter = read('aushadhi-export.service');
  assert.match(exporter, /^User=aushadhi$/m);
  assert.match(exporter, /^WorkingDirectory=\/opt\/aushadhi$/m);
  assert.match(exporter, /^MemoryHigh=4G$/m);
  assert.match(exporter, /^MemoryMax=5G$/m);
  assert.match(exporter, /^StateDirectory=aushadhi-export$/m);
  assert.match(exporter, /^Environment=HOME=\/var\/cache\/aushadhi\/export$/m);
  assert.match(exporter, /^Environment=XDG_CACHE_HOME=\/var\/cache\/aushadhi\/export$/m);
  assert.match(exporter, /^ReadOnlyPaths=\/opt\/aushadhi \/var\/lib\/aushadhi$/m);
  assert.match(exporter, /^LogsDirectory=aushadhi\/export$/m);
  assert.match(exporter, /^CacheDirectory=aushadhi\/export$/m);
  assert.match(exporter, /^ReadWritePaths=\/var\/log\/aushadhi\/export \/var\/cache\/aushadhi\/export \/var\/lib\/aushadhi-export$/m);

  const retention = read('aushadhi-cache-retention.service');
  assert.match(retention, /^NoNewPrivileges=true$/m);
  assert.match(retention, /^ProtectSystem=strict$/m);
  assert.match(retention, /^ProtectHome=true$/m);
  assert.match(retention, /^PrivateTmp=true$/m);
  assert.match(retention, /^PrivateDevices=true$/m);
  assert.match(retention, /^CacheDirectory=aushadhi\/retention$/m);
  assert.match(retention, /^ReadWritePaths=\/var\/lib\/aushadhi\/data\/raw \/var\/cache\/aushadhi\/retention$/m);
  assert.doesNotMatch(retention, /ReadWritePaths=.*\/var\/cache\/aushadhi(?:\s|$)/m);

  const sourceRetention = read('aushadhi-source-generation-retention.service');
  assert.match(sourceRetention, /^User=aushadhi$/m);
  assert.match(sourceRetention, /^Group=aushadhi$/m);
  assert.match(sourceRetention, /^Environment=AUSHADHI_DIST_ROOT=\/var\/lib\/aushadhi\/dist$/m);
  assert.match(sourceRetention, /^Environment=AUSHADHI_SOURCE_GENERATION_RETENTION_KEEP=14$/m);
  assert.match(sourceRetention, /^Environment=AUSHADHI_SOURCE_GENERATION_RETENTION_APPLY=0$/m);
  assert.match(sourceRetention, /^EnvironmentFile=-\/etc\/aushadhi\/source-generation-retention-apply\.conf$/m);
  assert.match(sourceRetention, /^ExecStart=\/usr\/local\/libexec\/aushadhi-source-generation-retention$/m);
  for (const setting of [
    'NoNewPrivileges=true',
    'ProtectSystem=strict',
    'ProtectHome=true',
    'PrivateTmp=true',
    'PrivateDevices=true',
    'RestrictNamespaces=true',
    'RestrictSUIDSGID=true',
    'CapabilityBoundingSet=',
    'AmbientCapabilities=',
    'RestrictAddressFamilies=AF_UNIX',
  ]) {
    assert.match(sourceRetention, new RegExp(`^${setting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
  assert.match(sourceRetention, /^StateDirectory=aushadhi\/dist$/m);
  assert.match(sourceRetention, /^CacheDirectory=aushadhi\/source-generation-retention$/m);
  assert.match(sourceRetention, /^ReadOnlyPaths=\/opt\/aushadhi$/m);
  assert.match(sourceRetention, /^ReadWritePaths=\/var\/lib\/aushadhi\/dist \/var\/cache\/aushadhi\/source-generation-retention$/m);
  assert.match(sourceRetention, /^InaccessiblePaths=\/root \/var\/lib\/aushadhi\/data \/var\/lib\/aushadhi-export$/m);
  assert.match(sourceRetention, /^MemoryMax=512M$/m);
  assert.doesNotMatch(sourceRetention, /ReadWritePaths=.*(?:\/opt\/aushadhi|\/var\/lib\/aushadhi\/data|\/var\/lib\/aushadhi-export)/m);

  const sourceRetentionTimer = read('aushadhi-source-generation-retention.timer');
  assert.match(sourceRetentionTimer, /^OnCalendar=Sun \*-\*-\* 05:00:00$/m);
  assert.match(sourceRetentionTimer, /^RandomizedDelaySec=20m$/m);
  assert.match(sourceRetentionTimer, /^Persistent=true$/m);
  assert.match(sourceRetentionTimer, /^Unit=aushadhi-source-generation-retention\.service$/m);
  assert.match(sourceRetentionTimer, /^WantedBy=timers\.target$/m);
});

test('root helpers, log rotation, and a release receipt are tracked', () => {
  for (const name of [
    'aushadhi-network-hook.py',
    'aushadhi-observer.py',
    'aushadhi-source-healthcheck.sh',
    'logrotate-aushadhi',
    'release-receipt.mjs',
    'runtime-manifest.json',
    'sudoers-aushadhi-observer',
  ]) {
    assert.equal(fs.existsSync(path.join(DEPLOY, name)), true, name);
  }

  const manifest = JSON.parse(read('runtime-manifest.json'));
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.install_root, '/opt/aushadhi');
  assert.equal(manifest.runtime_user, 'aushadhi');
  assert.equal(manifest.artifact_policy.profile, 'internal-evaluation');
  assert.equal(manifest.artifact_policy.redistributable, false);
  assert.equal(manifest.artifact_policy.production_authority, 'none');
  assert.equal(manifest.restricted_cdci.deployed, false);
  assert.equal(manifest.restricted_cdci.exported, false);
  assert.deepEqual(manifest.release_receipt.systemd_files, {
    uid: 0,
    gid: 0,
    mode: '0644',
  });
  assert.deepEqual(manifest.release_receipt.installed_tree, {
    uid: 0,
    gid: 0,
    root_mode: '0755',
    directory_mode: '0755',
    receipt_mode: '0644',
    tracked_file_modes_from_git: true,
    disallow_group_or_other_write: true,
  });
  for (const mapping of manifest.release_receipt.privileged_files) {
    assert.equal(mapping.uid, 0);
    assert.equal(mapping.gid, 0);
  }
  const receiptSource = read('release-receipt.mjs');
  assert.match(receiptSource, /installedRoot: path\.resolve\('\/opt\/aushadhi'\)/);
  assert.match(receiptSource, /systemdRoot: path\.resolve\('\/etc\/systemd\/system'\)/);
  assert.match(receiptSource, /privilegedRoot: path\.resolve\('\/'\)/);
  assert.match(receiptSource, /path\.resolve\('\/var\/lib\/aushadhi-export'\)/);
  assert.match(receiptSource, /--staging-test-mode/);
  assert.match(receiptSource, /release receipt generated and verified/);
  for (const field of [
    'repository_commit',
    'repository_tree_sha256',
    'installed_files_sha256',
    'systemd_files_sha256',
    'dependency_tree_sha256',
    'privileged_files_sha256',
    'installed_tree_metadata_sha256',
    'inspection_profile',
    'inspected_roots',
    'filesystem_policy',
    'runtime_manifest_sha256',
  ]) {
    assert.ok(manifest.release_receipt.required_fields.includes(field), field);
  }

  for (const name of [
    'aushadhi-export.service',
    'aushadhi-export-retention.service',
    'aushadhi-export-retention.timer',
    'aushadhi-source-generation-retention.service',
    'aushadhi-source-generation-retention.timer',
  ]) {
    assert.equal(fs.existsSync(path.join(DEPLOY, name)), true, name);
  }
  assert.equal(fs.existsSync(path.join(ROOT, 'deploy', 'aushadhi_nonroot_v2_export_retention.sh')), true);
  assert.equal(
    fs.existsSync(path.join(ROOT, 'deploy', 'aushadhi_nonroot_source_generation_retention.py')),
    true,
  );
  assert.deepEqual(
    manifest.release_receipt.privileged_files.find(
      (mapping) => mapping.target === 'usr/local/libexec/aushadhi-source-generation-retention',
    ),
    {
      source: 'deploy/aushadhi_nonroot_source_generation_retention.py',
      target: 'usr/local/libexec/aushadhi-source-generation-retention',
      mode: '0755',
      uid: 0,
      gid: 0,
    },
  );
  const exportSnapshot = fs.readFileSync(
    path.join(ROOT, 'deploy', 'aushadhi_nonroot_v2_export_snapshot.sh'),
    'utf8',
  );
  assert.match(exportSnapshot, /inspection_profile/);
  assert.match(exportSnapshot, /live release receipt must remain root:root 0644/);
  assert.match(exportSnapshot, /canonical runtime roots/);

  const logrotate = read('logrotate-aushadhi');
  assert.match(logrotate, /\/var\/log\/aushadhi\/\*\/\*\.log/);
  assert.match(logrotate, /rotate 8/);

  const sudoers = read('sudoers-aushadhi-observer');
  assert.doesNotMatch(sudoers, /sample-readonly|\*|\/bin\/(?:ba)?sh/);
  for (const action of [
    'healthcheck-crawl',
    'healthcheck-apollo',
    'healthcheck-netmeds',
    'healthcheck-pharmeasy',
  ]) {
    assert.match(sudoers, new RegExp(`^bahuleyan ALL=\\(root\\) NOPASSWD: \/usr\/local\/libexec\/aushadhi-observer ${action}$`, 'm'));
  }

  const sourceProbe = read('aushadhi-source-healthcheck.sh');
  assert.match(sourceProbe, /\[ "\$EUID" -eq 0 \]/);
  assert.match(sourceProbe, /PATH=\/usr\/local\/sbin:\/usr\/local\/bin:\/usr\/sbin:\/usr\/bin:\/sbin:\/bin/);
  assert.match(sourceProbe, /\/run\/lock\/aushadhi-network-hook\.lock/);
  assert.match(sourceProbe, /flock -n 9/);
  assert.match(sourceProbe, /ActiveState/);
  assert.match(sourceProbe, /fwmark 0xa05/);
  assert.match(sourceProbe, /iptables -t mangle -C OUTPUT/);
  assert.match(sourceProbe, /status_code != 200/);
});

test('deployment documentation has one current topology and no legacy root drop-ins', () => {
  const readme = read('README.md');
  assert.doesNotMatch(readme, /\/root\/aushadhi/);
  assert.match(readme, /\/opt\/aushadhi/);
  assert.match(readme, /separate explicit approval/iu);
  assert.match(readme, /aushadhi-network-hook/);
  assert.match(readme, /DEPLOYED-RELEASE\.json/);
  assert.match(readme, /aushadhi-source-generation-retention/);
  assert.match(readme, /dry-run/iu);

  for (const name of [
    'aushadhi-apollo.service.d',
    'aushadhi-build.service.d',
    'aushadhi-crawl.service.d',
    'aushadhi-netmeds.service.d',
    'aushadhi-pharmeasy.service.d',
  ]) {
    assert.equal(fs.existsSync(path.join(DEPLOY, name)), false, name);
  }
});
