import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../environments/environment';

interface Connection {
  id: string;
  name: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  /**
   * Authentication token returned from the Guacamole API. This token is
   * required for subsequent API calls and to embed client views via the
   * iframe URLs. Tokens expire after a period of inactivity (typically
   * 60 minutes).
   */
  token: string | null = null;
  /** The data source name returned from the API (e.g. "mysql" or "postgresql"). */
  dataSource: string | null = null;
  /** Flattened list of connection objects extracted from the connection tree. */
  connections: Connection[] = [];
  /** Currently maximized connection when the user clicks the expand icon. */
  selected?: Connection;
  /** Flag controlling display of the full‑screen modal. */
  maximizing = false;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.login();
  }

  /**
   * Performs authentication against the Guacamole REST API by sending the
   * username and password defined in the environment to the `/api/tokens`
   * endpoint. Upon success the returned `authToken` and `dataSource` values
   * are stored for later use. If authentication
   * fails an error is logged to the console.
   */
  login(): void {
    const body = new HttpParams()
      .set('username', environment.username)
      .set('password', environment.password);
    const headers = new HttpHeaders().set('Content-Type', 'application/x-www-form-urlencoded');
    this.http.post<any>(`${environment.apiUrl}/tokens`, body, { headers }).subscribe({
      next: res => {
        this.token = res.authToken;
        // Prefer the primary dataSource value returned, otherwise fall back to the first available
        this.dataSource = res.dataSource || (res.availableDataSources && Object.keys(res.availableDataSources)[0]);
        this.loadConnections();
      },
      error: err => {
        console.error('Failed to log in to Guacamole:', err);
      }
    });
  }

  /**
   * Retrieves the hierarchical tree of connection groups and connections
   * from Guacamole. The API expects a `guacamole-token` header containing
   * the previously obtained auth token. The tree
   * returned by `/connectionGroups/ROOT/tree` is then flattened into a
   * simple list of connections for display.
   */
  loadConnections(): void {
    if (!this.token || !this.dataSource) {
      return;
    }
    const headers = new HttpHeaders().set('guacamole-token', this.token);
    const url = `${environment.apiUrl}/session/data/${this.dataSource}/connectionGroups/ROOT/tree`;
    this.http.get<any>(url, { headers }).subscribe({
      next: res => {
        this.connections = this.flattenConnections(res);
      },
      error: err => {
        console.error('Failed to fetch connections:', err);
      }
    });
  }

  /**
   * Recursively walks the given connection group tree and extracts all
   * connections into a flat array. Each node may contain nested groups
   * under `childConnectionGroups` and individual connections under
   * `childConnections`.
   */
  private flattenConnections(node: any): Connection[] {
    const result: Connection[] = [];
    if (node.childConnections) {
      result.push(...node.childConnections.map((c: any) => ({ id: c.identifier, name: c.name })));
    }
    if (node.childConnectionGroups) {
      for (const group of node.childConnectionGroups) {
        result.push(...this.flattenConnections(group));
      }
    }
    return result;
  }

  /**
   * Builds the Guacamole client identifier used within URLs by encoding
   * the connection id, the type "c" and the data source name as a
   * base64url string. After encoding to
   * standard base64 the padding is removed and characters are made URL‑safe.
   */
  private getClientIdentifier(conn: Connection): string {
    let id = conn.id;
    // Extract numeric part if id contains a prefix (e.g. "c/5")
    if (id.includes('/')) {
      const parts = id.split('/');
      id = parts[parts.length - 1] || id;
    }
    const ds = this.dataSource ?? '';
    const raw = id + '\u0000' + 'c' + '\u0000' + ds;
    // Encode to base64 and convert to URL‑safe variant
    let b64 = btoa(raw);
    b64 = b64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return b64;
  }

  /**
   * Constructs the iframe URL for a given connection by combining the
   * Guacamole base URL, the encoded client identifier and the auth token.
   * The returned value is sanitized to bypass Angular's security
   * restrictions on resource URLs.
   */
  getIframeSrc(conn: Connection): SafeResourceUrl {
    if (!this.token) {
      return '' as unknown as SafeResourceUrl;
    }
    const clientId = this.getClientIdentifier(conn);
    const url = `http://localhost:8085/guacamole/#/client/${clientId}?token=${this.token}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * Handles click on the maximize icon. Stores the selected connection and
   * toggles the modal overlay.
   */
  openConnection(conn: Connection): void {
    this.selected = conn;
    this.maximizing = true;
  }

  /**
   * Closes the full‑screen view and resets the selected connection.
   */
  closeConnection(): void {
    this.selected = undefined;
    this.maximizing = false;
  }
}
