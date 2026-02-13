import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { ensureFirebaseAdminApp, getFirebaseAdminAuth } from "./firebaseAdmin";

function getDb() {
  ensureFirebaseAdminApp();
  return getFirestore();
}

export type Conversation = {
  id: string;
  title: string;
  created_at: Timestamp;
  last_message: Timestamp;
  message_count: number;
  preview: string;
};

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Timestamp;
};

export async function ensureUser(uid: string) {
  const db = getDb();
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    const user = await getFirebaseAdminAuth().getUser(uid);
    await userRef.set({
      email: user.email || null,
      name: user.displayName || null,
      created_at: FieldValue.serverTimestamp()
    });
  }
}

export async function createConversation(uid: string, title: string, firstMessage = "") {
  const db = getDb();
  await ensureUser(uid);
  const docRef = await db
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .add({
      title,
      created_at: FieldValue.serverTimestamp(),
      last_message: FieldValue.serverTimestamp(),
      message_count: 0,
      preview: firstMessage.length > 100 ? `${firstMessage.slice(0, 100)}...` : firstMessage
    });
  return docRef.id;
}

export async function listConversations(uid: string): Promise<Conversation[]> {
  const db = getDb();
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .orderBy("last_message", "desc")
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Conversation, "id">) }));
}

export async function updateConversation(
  uid: string,
  conversationId: string,
  updates: Partial<Pick<Conversation, "title" | "last_message" | "message_count" | "preview">>
) {
  const db = getDb();
  await db
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .set(updates, { merge: true });
}

export async function deleteConversation(uid: string, conversationId: string) {
  const db = getDb();
  const convRef = db.collection("users").doc(uid).collection("conversations").doc(conversationId);
  const messagesSnapshot = await convRef.collection("messages").get();
  const batch = db.batch();
  messagesSnapshot.forEach((doc) => batch.delete(doc.ref));
  batch.delete(convRef);
  await batch.commit();
}

export async function listMessages(
  uid: string,
  conversationId: string
): Promise<ConversationMessage[]> {
  const db = getDb();
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .orderBy("timestamp", "asc")
    .get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ConversationMessage, "id">) }));
}

export async function getLastUserMessage(uid: string, conversationId: string): Promise<string | null> {
  const db = getDb();
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .where("role", "==", "user")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  const data = doc.data() as { text?: string };
  return data.text || null;
}

export async function getLastAssistantMessage(uid: string, conversationId: string): Promise<string | null> {
  const db = getDb();
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .where("role", "==", "assistant")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  const data = doc.data() as { text?: string };
  return data.text || null;
}

export async function saveMessage(
  uid: string,
  conversationId: string,
  role: "user" | "assistant",
  text: string
) {
  const db = getDb();
  const convRef = db.collection("users").doc(uid).collection("conversations").doc(conversationId);
  await convRef.collection("messages").add({
    role,
    text,
    timestamp: FieldValue.serverTimestamp()
  });

  const preview = text.length > 100 ? `${text.slice(0, 100)}...` : text;
  await convRef.set(
    {
      last_message: FieldValue.serverTimestamp(),
      preview,
      message_count: FieldValue.increment(1)
    },
    { merge: true }
  );
}
