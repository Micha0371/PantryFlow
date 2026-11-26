'use strict';
// Keeps the app's private storage, including the saved sign-in session (AsyncStorage), out of
// Android cloud backup and device-to-device transfer (KAN-77; beta remediation plan, Priority 3).
// android:allowBackup="false" stops cloud backup, but for apps targeting Android 12+ some
// manufacturers still run device transfer; only data extraction rules control that.
// Everything the app shows is re-read from the server after sign-in, so nothing is lost.
const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external',
  'device_root', 'device_file', 'device_database', 'device_sharedpref'];
const RULES_RESOURCE = '@xml/data_extraction_rules';
const excludes = DOMAINS.map(domain => `    <exclude domain="${domain}" path="." />`).join('\n');
const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludes}
  </cloud-backup>
  <device-transfer>
${excludes}
  </device-transfer>
</data-extraction-rules>
`;

function applyBackupExclusion(manifest) {
  const application = manifest.manifest.application?.[0];
  if (!application) throw new Error('AndroidManifest.xml has no <application> element');
  application.$ = application.$ || {};
  application.$['android:allowBackup'] = 'false';
  application.$['android:dataExtractionRules'] = RULES_RESOURCE;
  return manifest;
}

function withBackupExclusion(config) {
  const withManifest = withAndroidManifest(config, modConfig => {
    applyBackupExclusion(modConfig.modResults);
    return modConfig;
  });
  return withDangerousMod(withManifest, ['android', async modConfig => {
    const folder = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'data_extraction_rules.xml'), DATA_EXTRACTION_RULES);
    return modConfig;
  }]);
}

module.exports = withBackupExclusion;
module.exports.applyBackupExclusion = applyBackupExclusion;
module.exports.DATA_EXTRACTION_RULES = DATA_EXTRACTION_RULES;
module.exports.DOMAINS = DOMAINS;
module.exports.RULES_RESOURCE = RULES_RESOURCE;
