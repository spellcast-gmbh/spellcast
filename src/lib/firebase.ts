import { initializeApp, applicationDefault, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { AgenticTrace, AgentEvent } from '@/models/agenticTraceSchemas';
import { env } from './env';

let firestore: Firestore;

/**
 * Initialize Firebase Admin SDK
 * Supports both environment variable service account and default credentials
 */
function initializeFirebase() {
  if (getApps().length === 0) {
    try {
      // Try to use service account from environment variable first
      if (env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccountJson = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
          credential: cert(serviceAccountJson),
          databaseURL: env.FIREBASE_DATABASE_URL,
        });
      } else {
        // Fall back to default credentials (works in Google Cloud environments)
        initializeApp({
          credential: applicationDefault(),
          databaseURL: env.FIREBASE_DATABASE_URL,
        });
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      throw new Error('Failed to initialize Firebase Admin SDK');
    }
  }

  firestore = getFirestore();
  return firestore;
}

// Initialize Firebase
export { initializeFirebase };

/**
 * Get Firestore instance (initializes if needed)
 */
export function getFirestoreInstance(): Firestore {
  if (!firestore) {
    return initializeFirebase();
  }
  return firestore;
}

/**
 * Collection names
 */
export const COLLECTIONS = {
  TRACES: 'agenticTraces',
  EVENTS: 'agentEvents',
} as const;

/**
 * Firebase utilities for AgenticTrace operations
 */
export class AgenticTraceFirebaseService {
  private db: Firestore;

  constructor() {
    this.db = getFirestoreInstance();
  }

  /**
   * Create a new agentic trace
   */
  async createTrace(trace: Omit<AgenticTrace, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgenticTrace> {
    const now = new Date().toISOString();
    const docRef = this.db.collection(COLLECTIONS.TRACES).doc();
    
    const newTrace: AgenticTrace = {
      ...trace,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(this.sanitizeForFirestore(newTrace) as Record<string, unknown>);
    return newTrace;
  }

  /**
   * Get a trace by ID
   */
  async getTrace(id: string): Promise<AgenticTrace | null> {
    const docRef = this.db.collection(COLLECTIONS.TRACES).doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return null;
    }

    return this.convertFromFirestore(doc.data()) as AgenticTrace;
  }

  /**
   * Update a trace
   */
  async updateTrace(id: string, updates: Partial<Omit<AgenticTrace, 'id' | 'createdAt'>>): Promise<void> {
    const docRef = this.db.collection(COLLECTIONS.TRACES).doc(id);
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.update(this.sanitizeForFirestore(updateData) as Record<string, unknown>);
  }

  /**
   * Add an event to a trace
   */
  async addEventToTrace(traceId: string, event: Omit<AgentEvent, 'id'>): Promise<AgentEvent> {
    const eventId = this.generateId();
    const fullEvent: AgentEvent = {
      ...event,
      id: eventId,
    };

    console.log('New event:', fullEvent);

    // Add event to the trace's events array
    const traceRef = this.db.collection(COLLECTIONS.TRACES).doc(traceId);
    await traceRef.update({
      events: FieldValue.arrayUnion(this.sanitizeForFirestore(fullEvent) as Record<string, unknown>),
      updatedAt: new Date().toISOString(),
    });

    return fullEvent;
  }

  /**
   * List traces with pagination
   */
  async listTraces(options: {
    cursor?: string;
    limit: number;
    orderBy: 'createdAt' | 'updatedAt' | 'name';
    orderDirection: 'asc' | 'desc';
    fields?: string[];
    onlyPending?: boolean;
  }) {
    let query = this.db
      .collection(COLLECTIONS.TRACES) as FirebaseFirestore.Query;

    // Add status filter if onlyPending is true
    if (options.onlyPending) {
      query = query.where('status', '==', 'pending');
    }

    query = query
      .orderBy(options.orderBy, options.orderDirection)
      .limit(options.limit + 1); // +1 to check if there are more

    // Handle cursor pagination
    if (options.cursor) {
      try {
        const cursorDoc = await this.db.collection(COLLECTIONS.TRACES).doc(options.cursor).get();
        if (cursorDoc.exists) {
          query = query.startAfter(cursorDoc);
        }
      } catch {
        throw new Error('Invalid cursor provided');
      }
    }

    const snapshot = await query.get();
    const traces = snapshot.docs.slice(0, options.limit).map((doc) => {
      const data = this.convertFromFirestore(doc.data()) as AgenticTrace;
      
      // Apply field projection if specified
      if (options.fields && options.fields.length > 0) {
        return this.projectFields(data, options.fields);
      }
      
      return data;
    });

    const hasMore = snapshot.docs.length > options.limit;
    const nextCursor = hasMore && traces.length > 0 ? traces[traces.length - 1].id : null;

    return {
      traces,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Delete a trace
   */
  async deleteTrace(id: string): Promise<void> {
    const docRef = this.db.collection(COLLECTIONS.TRACES).doc(id);
    await docRef.delete();
  }

  /**
   * Project only specified fields from a trace object
   */
  private projectFields(trace: AgenticTrace, fields: string[]): Partial<AgenticTrace> {
    const projected: Record<string, unknown> = {};
    
    fields.forEach(field => {
      if (field in trace) {
        projected[field] = (trace as Record<string, unknown>)[field];
      }
    });
    
    // Always include id
    projected.id = trace.id;
    
    return projected as Partial<AgenticTrace>;
  }

  /**
   * Generate a new document ID
   */
  private generateId(): string {
    return this.db.collection('_').doc().id;
  }

  /**
   * Sanitize data for Firestore (handle undefined values)
   */
  private sanitizeForFirestore(obj: unknown): Record<string, unknown> | unknown {
    if (obj === null || obj === undefined) {
      return null;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForFirestore(item));
    }

    if (typeof obj === 'object' && obj !== null && obj.constructor === Object) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          sanitized[key] = this.sanitizeForFirestore(value);
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Convert Firestore data back to application format
   */
  private convertFromFirestore(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.convertFromFirestore(item));
    }

    if (typeof data === 'object' && data.constructor === Object) {
      const converted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value instanceof Timestamp) {
          converted[key] = value.toDate().toISOString();
        } else {
          converted[key] = this.convertFromFirestore(value);
        }
      }
      return converted;
    }

    return data;
  }
}

// Export a singleton instance
export const agenticTraceService = new AgenticTraceFirebaseService();