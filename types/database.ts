// Generated-style types describing the Postgres schema.
// In a real workflow you'd regenerate this with:
//   npx supabase gen types typescript --project-id <id> > src/types/database.ts
// It's hand-written here to match supabase/migrations exactly so the app
// compiles correctly before you've connected a live project.

export type Platform = "pc" | "playstation" | "xbox" | "mobile";
export type PlayStyle = "casual" | "competitive";
export type PostCategory = "question" | "tutorial" | "bug" | "discussion";
export type RoomMode = "casual" | "competitive";
export type RoomStatus = "open" | "full" | "closed";
export type ReportStatus = "pending" | "valid" | "invalid";
export type ReportTargetType = "post" | "reply" | "user" | "room";
export type NotificationType =
  | "reply"
  | "upvote"
  | "accepted_answer"
  | "room_join"
  | "room_full"
  | "report_result"
  | "badge_earned"
  | "level_up"
  | "wallet_topup_result"
  | "currency_order_delivered"
  | "currency_order_cancelled"
  | "listing_review_result"
  | "listing_sold"
  | "listing_purchased"
  | "listing_removed"
  | "item_listing_sold"
  | "item_listing_purchased"
  | "item_listing_removed";
export type WalletTopupStatus = "pending" | "approved" | "rejected";
export type CurrencyOrderStatus = "pending_delivery" | "delivered" | "cancelled";
export type AccountListingStatus =
  | "pending_review"
  | "active"
  | "rejected"
  | "sold"
  | "removed";
export type ItemListingStatus = "active" | "sold_out" | "removed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          platform: Platform | null;
          play_style: PlayStyle | null;
          trust_score: number;
          xp: number;
          level: number;
          is_admin: boolean;
          last_seen_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          platform?: Platform | null;
          play_style?: PlayStyle | null;
          trust_score?: number;
          xp?: number;
          level?: number;
          is_admin?: boolean;
          last_seen_at?: string;
          created_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          platform?: Platform | null;
          play_style?: PlayStyle | null;
          last_seen_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          slug: string;
          name: string;
          banner_url: string | null;
          icon_url: string | null;
          accent_color: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          banner_url?: string | null;
          icon_url?: string | null;
          accent_color?: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          slug?: string;
          name?: string;
          banner_url?: string | null;
          icon_url?: string | null;
          accent_color?: string;
          description?: string | null;
        };
      };
      favorites: {
        Row: {
          user_id: string;
          game_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          game_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      posts: {
        Row: {
          id: string;
          game_id: string;
          author_id: string;
          title: string;
          body: string;
          category: PostCategory;
          is_pinned: boolean;
          accepted_reply_id: string | null;
          view_count: number;
          reply_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          author_id: string;
          title: string;
          body: string;
          category: PostCategory;
          is_pinned?: boolean;
          accepted_reply_id?: string | null;
          view_count?: number;
          reply_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          body?: string;
          category?: PostCategory;
          is_pinned?: boolean;
          accepted_reply_id?: string | null;
          view_count?: number;
          updated_at?: string;
        };
      };
      replies: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          upvote_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          body: string;
          upvote_count?: number;
          created_at?: string;
        };
        Update: {
          body?: string;
          upvote_count?: number;
        };
      };
      reply_votes: {
        Row: {
          reply_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          reply_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      rooms: {
        Row: {
          id: string;
          game_id: string;
          host_id: string;
          title: string;
          description: string | null;
          banner_url: string | null;
          mode: RoomMode;
          max_players: number;
          status: RoomStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          host_id: string;
          title: string;
          description?: string | null;
          banner_url?: string | null;
          mode?: RoomMode;
          max_players: number;
          status?: RoomStatus;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          banner_url?: string | null;
          mode?: RoomMode;
          max_players?: number;
          status?: RoomStatus;
        };
      };
      room_members: {
        Row: {
          room_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          room_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: Record<string, never>;
      };
      room_messages: {
        Row: {
          id: string;
          room_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          target_user_id: string | null;
          reason: string;
          status: ReportStatus;
          trust_penalty: number | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: ReportTargetType;
          target_id: string;
          target_user_id?: string | null;
          reason: string;
          status?: ReportStatus;
          trust_penalty?: number | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        // Reports are never updated directly from the client — resolution
        // happens exclusively through the resolve_report() RPC function,
        // which enforces the admin check server-side.
        Update: Record<string, never>;
      };
      trust_score_logs: {
        Row: {
          id: string;
          user_id: string;
          delta: number;
          reason: string;
          related_report_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          delta: number;
          reason: string;
          related_report_id?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      badges: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          icon: string;
          is_manual: boolean;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description: string;
          icon: string;
          is_manual?: boolean;
        };
        Update: Record<string, never>;
      };
      user_badges: {
        Row: {
          user_id: string;
          badge_id: string;
          earned_at: string;
        };
        Insert: {
          user_id: string;
          badge_id: string;
          earned_at?: string;
        };
        Update: Record<string, never>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          payload: Record<string, unknown>;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          payload?: Record<string, unknown>;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          is_read?: boolean;
        };
      };
      tags: {
        Row: {
          id: string;
          name: string;
          description: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          color?: string;
        };
      };
      user_tags: {
        Row: {
          user_id: string;
          tag_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        // No direct Insert/Update — only via assign_tag()/unassign_tag() RPCs.
        Insert: Record<string, never>;
        Update: Record<string, never>;
      };
      admin_logs: {
        Row: {
          id: string;
          admin_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          details: Record<string, unknown>;
          created_at: string;
        };
        // Insert-only via log_admin_action() RPC, never directly.
        Insert: Record<string, never>;
        Update: Record<string, never>;
      };
      wallets: {
        Row: {
          user_id: string;
          balance_rials: number;
          created_at: string;
          updated_at: string;
        };
        // No direct Insert/Update — only via get_or_create_wallet() and
        // approve_wallet_topup() RPCs.
        Insert: Record<string, never>;
        Update: Record<string, never>;
      };
      wallet_topup_requests: {
        Row: {
          id: string;
          user_id: string;
          amount_rials: number;
          receipt_image_url: string;
          reference_note: string;
          status: WalletTopupStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          admin_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_rials: number;
          receipt_image_url: string;
          reference_note: string;
          status?: WalletTopupStatus;
        };
        // No direct Update — only via approve_wallet_topup()/
        // reject_wallet_topup() RPCs.
        Update: Record<string, never>;
      };
      currency_products: {
        Row: {
          id: string;
          game_id: string;
          name: string;
          description: string | null;
          image_url: string | null;
          price_rials: number;
          currency_amount: number;
          currency_unit_label: string | null;
          is_active: boolean;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          name: string;
          description?: string | null;
          image_url?: string | null;
          price_rials: number;
          currency_amount: number;
          currency_unit_label?: string | null;
          is_active?: boolean;
          display_order?: number;
        };
        Update: {
          game_id?: string;
          name?: string;
          description?: string | null;
          image_url?: string | null;
          price_rials?: number;
          currency_amount?: number;
          currency_unit_label?: string | null;
          is_active?: boolean;
          display_order?: number;
        };
      };
      currency_orders: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          product_name: string;
          price_paid_rials: number;
          currency_amount: number;
          game_account_info: string;
          status: CurrencyOrderStatus;
          admin_note: string | null;
          delivered_by: string | null;
          delivered_at: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
      };
      site_settings: {
        Row: { key: string; value: unknown; updated_at: string; updated_by: string | null };
        Insert: Record<string, never>;
        Update: Record<string, never>;
      };
      account_listings: {
        Row: {
          id: string;
          seller_id: string;
          game_id: string;
          title: string;
          description: string;
          image_urls: string[];
          price_rials: number;
          status: AccountListingStatus;
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          buyer_id: string | null;
          sold_at: string | null;
          commission_percent_snapshot: number | null;
          payout_rials: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          game_id: string;
          title: string;
          description: string;
          image_urls?: string[];
          price_rials: number;
          status?: AccountListingStatus;
        };
        Update: Record<string, never>;
      };
      account_listing_delivery_info: {
        Row: {
          listing_id: string;
          instructions: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { listing_id: string; instructions: string };
        Update: { instructions?: string };
      };
      item_listings: {
        Row: {
          id: string;
          seller_id: string;
          game_id: string;
          name: string;
          description: string;
          image_urls: string[];
          price_rials: number;
          contact_info: string;
          quantity: number;
          status: ItemListingStatus;
          admin_note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          game_id: string;
          name: string;
          description: string;
          image_urls?: string[];
          price_rials: number;
          contact_info: string;
          quantity?: number;
          status?: ItemListingStatus;
        };
        Update: {
          name?: string;
          description?: string;
          image_urls?: string[];
          price_rials?: number;
          contact_info?: string;
        };
      };
      item_purchases: {
        Row: {
          id: string;
          listing_id: string;
          buyer_id: string;
          seller_id: string;
          price_paid_rials: number;
          payout_rials: number;
          commission_percent_snapshot: number;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
      };
    };
  };
}
