const { withGradleProperties } = require("@expo/config-plugins");

/**
 * AsyncStorage（Android）のデータベースの上限を広げる（gradle.properties の
 * `AsyncStorage_db_size_in_MB`）。
 *
 * Why: @react-native-async-storage/async-storage の Android 実装は、既定でデータベース全体の
 * 上限が 6 MB（node_modules/@react-native-async-storage/async-storage/android/config.gradle）。
 * Sprint 19b のデータ読み込み（F53）は 10 MB までの CSV を受け付けるため、読み込んだ記録を
 * 保存しようとすると上限を超えて保存できないことがある。保存データは 1 つのキーに収まらない
 * 大きさのとき分割して保存する（src/store/createDiaryStore.ts）が、データベース全体の上限は
 * ここで広げる必要がある。
 */
const DB_SIZE_MB = "64";

module.exports = function withAsyncStorageSize(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter(
      (item) => !(item.type === "property" && item.key === "AsyncStorage_db_size_in_MB")
    );
    props.push({ type: "property", key: "AsyncStorage_db_size_in_MB", value: DB_SIZE_MB });
    cfg.modResults = props;
    return cfg;
  });
};
