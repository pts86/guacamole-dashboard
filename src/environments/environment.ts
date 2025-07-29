export const environment = {
  production: false,
  /**
   * Base URL for the Guacamole REST API. Adjust this value if your server
   * listens on a different host or port. During development, the Angular
   * application runs on a separate port (typically 4200) and this API
   * endpoint will be proxied to the Guacamole server running on port 8085.
   */
  apiUrl: 'http://localhost:8085/guacamole/api',
  /**
   * Default credentials used to obtain an authentication token from Guacamole.
   * These values can be overridden in production or through environment
   * variables when deploying the application.
   */
  username: 'guacadmin',
  password: 'guacadmin'
};
