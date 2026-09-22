// Public Website media slot definitions — shared pure data.
// Used by the admin Manage Page media manager (client), the useMediaAsset hook
// (client), and the /api/settings/public/media + /api/media/[assetKey] routes
// (server). No React/server dependency here so it is safe to import anywhere.
//
// Reconstructed 1:1 from the deployed production implementation (the media
// system was previously deployed without being committed to this repository).

export type MediaSlotType = "image" | "video" | "logo";

export type MediaSlot = {
  key: string;
  type: MediaSlotType;
  label: string;
  usage: string;
  fallback: string;
  accept: string;
};

export const MEDIA_SLOTS: MediaSlot[] = [
  {
    key: "landing_hero_video",
    type: "video",
    label: "Landing Hero Video",
    usage: "app/page.tsx hero background",
    fallback: "/videos/Websmith Digital.mp4",
    accept: "video/mp4,video/webm,video/ogg",
  },
  {
    key: "global_collaboration_image",
    type: "image",
    label: "Global Collaboration Image",
    usage: "app/page.tsx 'Global Collaboration' image",
    fallback: "/images/photo-1552664730-d307ca884978.jpg",
    accept: "image/png,image/jpeg,image/webp,image/gif",
  },
  {
    key: "global_collaboration_video",
    type: "video",
    label: "Global Collaboration Video",
    usage: "app/page.tsx 'Global Collaboration' video",
    fallback: "/videos/WDS_UAC.mp4",
    accept: "video/mp4,video/webm,video/ogg",
  },
  {
    key: "internal_api_login_background",
    type: "video",
    label: "Internal API Login Background",
    usage: "app/internal/api/auth/login background",
    fallback: "/videos/WDS_UAC.mp4",
    accept: "video/mp4,video/webm,video/ogg",
  },
  {
    key: "internal_api_register_background",
    type: "video",
    label: "Internal API Register Background",
    usage: "app/internal/api/auth/register background",
    fallback: "/videos/API-Center.mp4",
    accept: "video/mp4,video/webm,video/ogg",
  },
  {
    key: "internal_api_forgot_password_background",
    type: "video",
    label: "Internal API Forgot Password Background",
    usage: "app/internal/api/auth/forgot-password background",
    fallback: "/videos/API-Center.mp4",
    accept: "video/mp4,video/webm,video/ogg",
  },
  {
    key: "internal_api_reset_password_background",
    type: "video",
    label: "Internal API Reset Password Background",
    usage: "app/internal/api/auth/reset-password background",
    fallback: "/videos/API-Center.mp4",
    accept: "video/mp4,video/webm,video/ogg",
  },
  {
    key: "chat_messenger_logo",
    type: "logo",
    label: "Chat Messenger Logo",
    usage: "app/chat/[id] masked circular logo",
    fallback: "/images/wsd.png",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml",
  },
  {
    key: "panel_sidebar_logo",
    type: "logo",
    label: "Panel Sidebar Logo",
    usage: "components/layout/Sidebar.tsx (all panel pages incl. Manage Page)",
    fallback: "/images/icon.png",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml",
  },
  {
    key: "android_chrome_logo",
    type: "logo",
    label: "Android Chrome Logo",
    usage: "app/admin/manage-page Android Chrome favicon upload",
    fallback: "/images/icon.png",
    accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml",
  },
  {
    key: "landing_feature_card_background_1",
    type: "image",
    label: "Landing Feature Card Background 1",
    usage: "app/page.tsx 'Why Choose Websmith' feature card 1",
    fallback: "/images/wsd.png",
    accept: "image/png,image/jpeg,image/webp,image/gif",
  },
  {
    key: "landing_feature_card_background_2",
    type: "image",
    label: "Landing Feature Card Background 2",
    usage: "app/page.tsx 'Why Choose Websmith' feature card 2",
    fallback: "/images/wsd.png",
    accept: "image/png,image/jpeg,image/webp,image/gif",
  },
  {
    key: "landing_feature_card_background_3",
    type: "image",
    label: "Landing Feature Card Background 3",
    usage: "app/page.tsx 'Why Choose Websmith' feature card 3",
    fallback: "/images/wsd.png",
    accept: "image/png,image/jpeg,image/webp,image/gif",
  },
  {
    key: "landing_feature_card_background_4",
    type: "image",
    label: "Landing Feature Card Background 4",
    usage: "app/page.tsx 'Why Choose Websmith' feature card 4",
    fallback: "/images/wsd.png",
    accept: "image/png,image/jpeg,image/webp,image/gif",
  },
  {
    key: "landing_feature_card_background_5",
    type: "image",
    label: "Landing Feature Card Background 5",
    usage: "app/page.tsx 'Why Choose Websmith' feature card 5",
    fallback: "/images/wsd.png",
    accept: "image/png,image/jpeg,image/webp,image/gif",
  },
];

export const MEDIA_SLOT_INDEX: Map<string, MediaSlot> = new Map(
  MEDIA_SLOTS.map((slot) => [slot.key, slot])
);

export function fallbackForSlot(key: string): string {
  return MEDIA_SLOT_INDEX.get(key)?.fallback ?? "";
}

export type MediaAsset = {
  url: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  updatedAt: string;
  managed: boolean;
};

export function emptyMediaAsset(key: string): MediaAsset {
  return {
    url: fallbackForSlot(key),
    fileName: "",
    contentType: "",
    fileSize: 0,
    updatedAt: "",
    managed: false,
  };
}

// Window event dispatched after a successful admin upload. useMediaAsset
// listeners re-fetch the media map, so every consumer updates immediately
// without a page reload.
export const MEDIA_UPDATED_EVENT = "media-updated";

export const MAX_MEDIA_FILE_SIZE = 4 * 1024 * 1024;