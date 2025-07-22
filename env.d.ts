declare namespace NodeJS {
	interface ProcessEnv {
		NODE_ENV: "development" | "production" | "test";
		GMAIL_USER: string;
		GMAIL_PASS: string;
		/**
		 * @env UPLOAD_SCRIPT_URL
		 * URL of the upload script endpoint. Obtain from your backend or file handling service provider.
		 */
		UPLOAD_SCRIPT_URL: string;
		/**
		 * @env BASE_URL
		 * The base URL of your application (e.g., https://yourdomain.com).
		 */
		BASE_URL: string;
		/**
		 * @env MONGODB_URI
		 * MongoDB connection string. Obtain from MongoDB Atlas or your MongoDB server.
		 */
		MONGODB_URI: string;
		/**
		 * @env MONGODB_DB
		 * Name of the MongoDB database to use.
		 */
		MONGODB_DB: string;
		/**
		 * @env type
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		type: string;
		/**
		 * @env project_id
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		project_id: string;
		/**
		 * @env private_key_id
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		private_key_id: string;
		/**
		 * @env private_key
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		private_key: string;
		/**
		 * @env client_email
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		client_email: string;
		/**
		 * @env client_id
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		client_id: string;
		/**
		 * @env auth_uri
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		auth_uri: string;
		/**
		 * @env token_uri
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		token_uri: string;
		/**
		 * @env auth_provider_x509_cert_url
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		auth_provider_x509_cert_url: string;
		/**
		 * @env client_x509_cert_url
		 * Google service account field. Obtain from your Google Cloud service account JSON.
		 */
		client_x509_cert_url: string;
		// Add other environment variables here as needed
	}
}
