export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const IMAGEKIT_ID = process.env.NEXT_PUBLIC_IMAGEKIT_ID!;
export const IMAGEKIT_URL_ENDPOINT = (process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? "").replace(/\/$/, "");
export const IMAGEKIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY!;

/** Turn on after enabling "Restrict unsigned URLs" for videos in the ImageKit dashboard. */
export const SIGNED_DELIVERY = process.env.NEXT_PUBLIC_IMAGEKIT_SIGNED_DELIVERY === "true";

/** Player analytics is an ImageKit Enterprise feature. */
export const PLAYER_ANALYTICS = process.env.NEXT_PUBLIC_PLAYER_ANALYTICS === "true";

/** Folder in the ImageKit media library that studio uploads go to. */
export const VIDEO_FOLDER = "/videos";
