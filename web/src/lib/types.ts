export type Role = "ADMIN" | "SUPPORT" | "CONSULTANT" | "CLIENT";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  expertise?: string;
  title?: string;
  isActive?: boolean;
  maxDevices?: number;
  tags?: string[];
  scopes?: string[];
};

export type PackageChannel = "TEXT" | "AUDIO" | "VIDEO" | "COMBINED";

export type ConsultantRef = { id: string; name: string; title?: string };

export type Package = {
  id: string;
  name: string;
  description?: string;
  type: "ONE_TIME" | "MONTHLY" | "ANNUAL" | "CUSTOM";
  channel: PackageChannel;
  price: number;
  currency: string;
  isActive: boolean;
  isGlobal: boolean;
  consultants?: ConsultantRef[];
  textLimit: number | null;
  audioLimit: number | null;
  videoLimit: number | null;
  sessionLimit: number | null;
  sessionDuration: number | null;
  audioDuration: number | null;
  videoDuration: number | null;
  responseAllowance: number | null;
  textWordLimit: number | null;
  consultationMode: "CHAT" | "SINGLE";
  billingDays: number | null;
};

export type MessageReaction = {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "AUDIO" | "VIDEO" | "IMAGE" | "FILE";
  body?: string;
  mediaUrl?: string;
  fileName?: string;
  durationSec?: number;
  status: "SENT" | "DELIVERED" | "READ";
  editedAt?: string | null;
  deletedAt?: string | null;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    body?: string | null;
    type: string;
    sender?: { id: string; name: string };
  } | null;
  reactions?: MessageReaction[];
  createdAt: string;
};

export type Conversation = {
  id: string;
  clientId: string;
  consultantId: string;
  lastMessageAt: string;
  client?: User;
  consultant?: User;
  messages?: Message[];
};

export type Meeting = {
  id: string;
  clientId: string;
  consultantId: string;
  title: string;
  scheduledAt: string;
  durationMin: number;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
  meetingUrl?: string;
  notes?: string;
  client?: User;
  consultant?: User;
};

export type Community = {
  id: string;
  name: string;
  description?: string;
  isPaid: boolean;
  price: number;
  currency: string;
  isActive: boolean;
  _count?: { members: number; posts: number };
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
};

// Remaining per-channel allowance for a client with a consultant. Powers the
// chat composer's enable/disable state.
export type ChannelAllowance = {
  allowed: boolean;
  unlimited: boolean;
  remaining: number | null;
};

export type Allowance = {
  text: ChannelAllowance;
  audio: ChannelAllowance;
  video: ChannelAllowance;
  session: ChannelAllowance;
};
