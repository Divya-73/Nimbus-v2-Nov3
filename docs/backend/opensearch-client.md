# NIMBUS: OpenSearch Client

## 1. Purpose of `client.js`

`backend/opensearch/client.js` sets up the shared client that the NIMBUS backend uses to communicate with OpenSearch.
It loads connection settings, configures authentication and SSL, and provides a function to test connectivity.

## 2. Simple Flow Diagram

```text
Backend API / Query File → client.js → OpenSearch → Response back to Backend
```

## 3. How the File Works

- **Load settings:** Reads `backend/.env` using `dotenv`. The path is based on the file's location.
- **Validate required values:** The `req()` helper trims each required value and throws an error if it is missing or empty. This stops client initialization when required settings are unavailable.
- **Create the client:** Combines the protocol, host, and port into the OpenSearch address and exports a shared `client`. Creating this object alone does not confirm connectivity.
- **Set authentication:** Uses the configured username and password for OpenSearch requests.
- **Configure SSL:** Loads `backend/cert/ahES.crt` as a custom CA certificate if it exists. Certificate verification stays enabled unless `OPENSEARCH_SSL_REJECT_UNAUTHORIZED` is exactly `false`.
- **Set timeout:** Uses `OPENSEARCH_REQUEST_TIMEOUT_MS` for the request timeout. It defaults to 12 seconds if the value is missing, empty, nonnumeric, or zero.
- **Test connectivity:** `testConnection()` requests cluster health and logs the cluster name, status, and node count. It returns `true` when the request succeeds or logs an error and returns `false` when it fails. It does not reject a successful response based on cluster status.

Running `node backend/opensearch/client.js` from the project root automatically runs the test and exits with code `0` for success or `1` for failure. Importing the file does not automatically run this test.

## 4. Important Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENSEARCH_PROTOCOL` | Required: connection protocol, such as `https`. |
| `OPENSEARCH_HOST` | Required: OpenSearch hostname or IP address. |
| `OPENSEARCH_PORT` | Required: OpenSearch server port. |
| `OPENSEARCH_USERNAME` | Required: authentication username. |
| `OPENSEARCH_PASSWORD` | Required: authentication password. |
| `OPENSEARCH_REQUEST_TIMEOUT_MS` | Optional: request timeout in milliseconds. |
| `OPENSEARCH_SSL_REJECT_UNAUTHORIZED` | Optional: controls server certificate verification. |

## 5. How Other Backend Files Use It

Backend and query files import the shared `client` instead of creating separate OpenSearch clients. They use it to send requests such as fetching, searching, or saving documents. The queries themselves stay in those files.

For example, a file inside `backend/src/queries/` imports it using:

```js
import { client } from '../../opensearch/client.js';
```

## 6. One-Line Summary

`client.js` is the common connection layer between the NIMBUS backend and OpenSearch.
