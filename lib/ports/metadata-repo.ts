/**
 * Port: MetadataRepo
 *
 * Read/write access to app-specific data that does NOT live in Kublau:
 * notification versions, comments, flow definitions, integration links.
 * Today implemented by `lib/adapters/supabase/`.
 */

export interface NotificationVersion {
  id: string;
  kublauNotificationId: string;
  versionNumber: number;
  authorId: string;
  changeSummary: string | null;
  snapshot: Record<string, unknown>;
  createdAt: Date;
}

export interface SaveVersionInput {
  kublauNotificationId: string;
  authorId: string;
  changeSummary: string | null;
  snapshot: Record<string, unknown>;
}

export interface Flow {
  id: string;
  name: string;
  client: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowStep {
  id: string;
  flowId: string;
  kublauNotificationId: string;
  position: number;
  triggerCondition: string | null;
}

export interface IntegrationLink {
  id: string;
  kublauNotificationId: string;
  type: "asana" | "gmail" | "freepik";
  externalId: string;
  metadata: Record<string, unknown> | null;
  lastSyncedAt: Date | null;
}

export interface MetadataRepo {
  // versioning
  listVersions(kublauNotificationId: string): Promise<NotificationVersion[]>;
  saveVersion(input: SaveVersionInput): Promise<NotificationVersion>;

  // flows
  listFlows(client?: string): Promise<Flow[]>;
  getFlow(id: string): Promise<{ flow: Flow; steps: FlowStep[] } | null>;

  // integration links
  listLinks(kublauNotificationId: string): Promise<IntegrationLink[]>;
}
