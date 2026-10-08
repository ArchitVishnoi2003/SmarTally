/// Backend API — use ONE of these after deploy (see DEPLOYMENT_REPORT.md).
class AppConfig {
  static const String firebaseProjectId = 'shopautomation-8de09';

  /// Vercel (recommended, no card): https://YOUR-PROJECT.vercel.app/api
  /// Firebase Functions (needs Blaze): https://asia-south1-shopautomation-8de09.cloudfunctions.net
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://tally-amber.vercel.app/api',
  );

  static String functionUrl(String name) => '$apiBaseUrl/$name';
}
