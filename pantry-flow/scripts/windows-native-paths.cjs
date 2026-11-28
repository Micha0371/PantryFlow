'use strict';
// Windows: all CMake projects need short paths, including Reanimated/Worklets libraries.
// Moves the app's and every native library's CMake staging folder to `staging` (forward
// slashes) and caps object paths. No installed package sources are modified.
// Used by the e2e test build and the signed release build, each with its own staging folder.
const fs = require('node:fs');
const path = require('node:path');

function applyWindowsNativePaths(androidDir, staging) {
  const buildFile = path.join(androidDir, 'app/build.gradle');
  const content = fs.readFileSync(buildFile, 'utf8').replace('android {',
    `android {\n    externalNativeBuild { cmake { buildStagingDirectory file('${staging}/app') } }\n    defaultConfig { externalNativeBuild { cmake { arguments '-DCMAKE_OBJECT_PATH_MAX=250' } } }`);
  fs.writeFileSync(buildFile, content);
  fs.appendFileSync(path.join(androidDir, 'build.gradle'), `
// Windows test-build cache paths; no installed package sources are modified.
subprojects { nativeProject ->
    nativeProject.plugins.withId('com.android.library') {
        nativeProject.android {
            externalNativeBuild { cmake {
                buildStagingDirectory file('${staging}/' + Integer.toHexString(nativeProject.path.hashCode()))
            } }
            defaultConfig { externalNativeBuild { cmake {
                arguments '-DCMAKE_OBJECT_PATH_MAX=250'
            } } }
        }
    }
}
`);
}

module.exports = { applyWindowsNativePaths };
