/**
 * Mock user + user-scoped fixtures (library, bookmarks seed data).
 *
 * NOTE: `passwordMock` below is plaintext on purpose — this is a throwaway
 * mock store for local UI development, not a real auth system. Real
 * authentication (hashing, sessions, etc.) is Better Auth's job on the
 * backend session. See lib/server/mock-auth.ts for the (also mock) cookie
 * handling this backs.
 */

export type LibraryFormat = "ebook" | "audiobook";
export type LibraryStatus = "not-started" | "in-progress" | "completed";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  country?: string;
  phone?: string;
  createdAt: string;
  roles: Array<"customer" | "admin">;
}

export interface MockUserRecord extends MockUser {
  /** Plaintext mock credential — see file header. Never sent to the client. */
  passwordMock: string;
}

export interface LibraryItem {
  id: string;
  userId: string;
  bookSlug: string;
  bookTitle: string;
  cover: string;
  editionId: string;
  format: LibraryFormat;
  status: LibraryStatus;
  progressPercent: number;
  currentChapterIdx: number;
  updatedAt: string;
}

export const MOCK_USERS: MockUserRecord[] = [
  {
    id: "usr_1",
    name: "Amina Wanjiru",
    email: "demo@wangechi.test",
    passwordMock: "password123",
    avatar: "/avatars/amina.png",
    country: "Kenya",
    phone: "+254712345678",
    createdAt: "2025-01-15T08:00:00.000Z",
    roles: ["customer"],
  },
  {
    id: "usr_2",
    name: "Grace Otieno",
    email: "grace.otieno@example.com",
    passwordMock: "hunter2rebuild",
    avatar: "/avatars/grace.png",
    country: "Kenya",
    phone: "+254798765432",
    createdAt: "2025-06-02T08:00:00.000Z",
    roles: ["customer"],
  },
  {
    id: "usr_admin",
    name: "Felister Kariuki",
    email: "felister@wangechi.test",
    passwordMock: "adminpassword",
    avatar: "/avatars/felister.png",
    country: "Kenya",
    phone: "+254700000000",
    createdAt: "2024-11-01T08:00:00.000Z",
    roles: ["admin", "customer"],
  },
];

/**
 * Library entries — only usr_1 (the demo login) has meaningful seed data so
 * the dashboard has something to render out of the box. Other users get an
 * empty library, matching how a real new signup would look.
 */
export const MOCK_LIBRARY: LibraryItem[] = [
  {
    id: "lib_1",
    userId: "usr_1",
    bookSlug: "from-pieces-to-power",
    bookTitle: "From Pieces To Power",
    cover: "/books/from-pieces-to-power/cover.jpg",
    editionId: "fptp-ebook-v1",
    format: "ebook",
    status: "in-progress",
    progressPercent: 42,
    currentChapterIdx: 2,
    updatedAt: "2026-08-20T18:32:00.000Z",
  },
  {
    id: "lib_2",
    userId: "usr_1",
    bookSlug: "from-pieces-to-power",
    bookTitle: "From Pieces To Power",
    cover: "/books/from-pieces-to-power/cover.jpg",
    editionId: "fptp-audio-v1",
    format: "audiobook",
    status: "not-started",
    progressPercent: 0,
    currentChapterIdx: 0,
    updatedAt: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "lib_3",
    userId: "usr_1",
    bookSlug: "the-shea-ledger",
    bookTitle: "The Shea Ledger",
    cover: "/books/the-shea-ledger/cover.jpg",
    editionId: "shea-ledger-ebook-v1",
    format: "ebook",
    status: "completed",
    progressPercent: 100,
    currentChapterIdx: 2,
    updatedAt: "2026-06-14T12:00:00.000Z",
  },
];

export function findUserByEmail(email: string): MockUserRecord | undefined {
  return MOCK_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  );
}

export function findUserById(id: string): MockUserRecord | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}

let nextUserSeq = MOCK_USERS.length + 1;

/**
 * Mock signup: pushes a new record into the in-memory MOCK_USERS array.
 * Resets on server restart, same as the rest of this mock layer.
 */
export function createUser(input: {
  name: string;
  email: string;
  password: string;
  country?: string;
  phone?: string;
}): MockUserRecord {
  const record: MockUserRecord = {
    id: `usr_${nextUserSeq++}`,
    name: input.name,
    email: input.email,
    passwordMock: input.password,
    country: input.country,
    phone: input.phone,
    createdAt: new Date().toISOString(),
    roles: ["customer"],
  };
  MOCK_USERS.push(record);
  return record;
}

export function toPublicUser(record: MockUserRecord): MockUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to strip it
  const { passwordMock: _passwordMock, ...publicUser } = record;
  return publicUser;
}

export function getLibraryForUser(userId: string): LibraryItem[] {
  return MOCK_LIBRARY.filter((item) => item.userId === userId);
}
