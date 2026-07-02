const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * Adds `-Xskip-metadata-version-check` to every Kotlin compile task in the
 * Android project.
 *
 * Why: react-native-google-mobile-ads@16.4.0 pulls in Google's
 * play-services-ads:25.4.0, whose .kotlin_module metadata is binary version
 * 2.3.0. Expo SDK 56 / React Native 0.85.3 compile third-party native library
 * modules with Kotlin 2.1.x (max readable metadata 2.2.0), so the compile fails
 * with "Module was compiled with an incompatible version of Kotlin. The binary
 * version of its metadata is 2.3.0, expected version is 2.1.0."
 *
 * Bumping `android.kotlinVersion` via expo-build-properties does NOT fix this
 * because that override is not applied to how the RN Gradle plugin compiles the
 * library modules. The Kotlin compiler explicitly recommends this flag in the
 * error message ("... or use '-Xskip-metadata-version-check' to suppress
 * errors"). The AdMob classes are ABI-stable, so skipping the metadata version
 * check is safe here.
 */
const SNIPPET = [
  "",
  "// Injected by plugins/withKotlinSkipMetadataCheck.js",
  "// Allow compiling against dependencies (e.g. play-services-ads 25.4.0) whose",
  "// Kotlin metadata is newer than the Kotlin compiler used for library modules.",
  "allprojects {",
  "    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {",
  '        compilerOptions {',
  '            freeCompilerArgs.add("-Xskip-metadata-version-check")',
  "        }",
  "    }",
  "}",
  "",
].join("\n");

const withKotlinSkipMetadataCheck = (config) => {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "withKotlinSkipMetadataCheck: root build.gradle is not Groovy; cannot inject snippet."
      );
    }
    if (!cfg.modResults.contents.includes("-Xskip-metadata-version-check")) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};

module.exports = withKotlinSkipMetadataCheck;
