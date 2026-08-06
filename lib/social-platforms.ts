// Social platform metadata (icon + brand color) for rendering official social
// links from the Website Settings (contact_info) record. Client-safe.
import {
  FaWhatsapp,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import type { SocialUrlKey } from "./site-settings";

export type SocialPlatformMeta = {
  key: SocialUrlKey;
  label: string;
  icon: IconType;
  color: string;
};

export const SOCIAL_PLATFORM_META: SocialPlatformMeta[] = [
  { key: "whatsapp_url", label: "WhatsApp", icon: FaWhatsapp, color: "#25D366" },
  { key: "facebook_url", label: "Facebook", icon: FaFacebook, color: "#1877F2" },
  { key: "instagram_url", label: "Instagram", icon: FaInstagram, color: "#E4405F" },
  { key: "linkedin_url", label: "LinkedIn", icon: FaLinkedin, color: "#0A66C2" },
  { key: "x_url", label: "X (Twitter)", icon: FaTwitter, color: "#14171A" },
  { key: "youtube_url", label: "YouTube", icon: FaYoutube, color: "#FF0000" },
];
